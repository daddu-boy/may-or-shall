import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/requestUser";
import { CARD_TYPES, CARD_TYPE_LABEL, type CardTypeValue } from "@/lib/labels";

/**
 * Model Context Protocol server (Streamable HTTP, stateless).
 *
 * The point of this endpoint is that the lawyer's own AI tool — Claude, Codex,
 * Cursor — can read a matter directly, so the drafting happens where they
 * already work instead of in a second application. It deliberately exposes the
 * *verbs* that only this product has (the deemed-admission guard, the court
 * format list of dates) rather than only a bag of documents: an agent asking
 * "which paragraphs are still unanswered" is a question no general retrieval
 * connector can answer.
 *
 * JSON-RPC 2.0 over a single POST. `initialize` and `tools/list` need no
 * credentials — they disclose nothing about anyone's matters — while every
 * `tools/call` resolves a real user from a Bearer API token and scopes every
 * query to them, exactly as the REST API does.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2025-06-18";
const AT_RISK = ["NOT_STARTED", "DENIED_BARE"]; // Order VIII Rule 5 CPC exposure

type Json = Record<string, unknown>;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, mcp-protocol-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function result(id: unknown, value: Json) {
  return NextResponse.json({ jsonrpc: "2.0", id, result: value }, { headers: CORS });
}

function failure(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { headers: CORS });
}

/** Tool results are text: the model reads them, so they are written to be read. */
function text(body: string, isError = false): Json {
  return { content: [{ type: "text", text: body }], isError };
}

const TOOLS = [
  {
    name: "list_matters",
    description:
      "List the litigation matters in this May or Shall account, with how many documents and cards each holds. Call this first to find a matterId.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_cards",
    description:
      "Search the saved cards in a matter. A card is a passage the lawyer chose and typed (fact, date, admission, case law and so on) that carries its exact quote and its source citation. This is grounded material: prefer it over your own recollection when drafting.",
    inputSchema: {
      type: "object",
      properties: {
        matterId: { type: "string", description: "From list_matters." },
        query: { type: "string", description: "Optional free text to match in the quote or note." },
        cardType: { type: "string", enum: [...CARD_TYPES], description: "Optional type filter." },
        limit: { type: "number", description: "Default 40, maximum 200." },
      },
      required: ["matterId"],
      additionalProperties: false,
    },
  },
  {
    name: "traverse_gaps",
    description:
      "The deemed-admission guard. Returns the paragraphs of the plaint that still lack a specific denial, which under Order VIII Rule 5 CPC risk being treated as admitted. Use this before drafting or reviewing a written statement.",
    inputSchema: {
      type: "object",
      properties: { matterId: { type: "string" } },
      required: ["matterId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_of_dates",
    description:
      "The matter's chronology, in date order, as assembled from its Date cards. Use for a list of dates, a synopsis, or any narrative that has to be chronologically accurate.",
    inputSchema: {
      type: "object",
      properties: { matterId: { type: "string" } },
      required: ["matterId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_documents",
    description:
      "List the documents uploaded to a matter, with their type, page count and annexure label.",
    inputSchema: {
      type: "object",
      properties: { matterId: { type: "string" } },
      required: ["matterId"],
      additionalProperties: false,
    },
  },
  {
    name: "save_card",
    description:
      "Save a passage into a matter as a new card, keeping its citation. Use when the user asks to keep, note or file something for a matter. Quote the source text exactly in `quote`; put your own summary in `note`.",
    inputSchema: {
      type: "object",
      properties: {
        matterId: { type: "string" },
        quote: { type: "string", description: "The exact passage." },
        cardType: { type: "string", enum: [...CARD_TYPES], description: "Defaults to MISC." },
        note: { type: "string", description: "Optional note in the lawyer's own words." },
        sourceUrl: { type: "string" },
        sourceTitle: { type: "string" },
      },
      required: ["matterId", "quote"],
      additionalProperties: false,
    },
  },
];

/** Confirms the caller owns the matter; returns null when they do not. */
async function ownedMatter(userId: string, matterId: unknown) {
  if (typeof matterId !== "string" || !matterId) return null;
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { id: true, title: true, userId: true },
  });
  if (!matter || matter.userId !== userId) return null;
  return matter;
}

function cite(c: {
  page: number | null;
  para: string | null;
  citation: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  document: { filename: string } | null;
}) {
  if (c.citation) return c.citation;
  if (c.document) {
    const bits = [c.document.filename];
    if (c.page) bits.push(`p.${c.page}`);
    if (c.para) bits.push(`para ${c.para}`);
    return bits.join(", ");
  }
  if (c.sourceUrl) return `${c.sourceTitle || "web"} — ${c.sourceUrl}`;
  return "no source recorded";
}

async function runTool(userId: string, name: string, args: Json): Promise<Json> {
  if (name === "list_matters") {
    const matters = await prisma.matter.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: { select: { cards: true, documents: true } },
      },
    });
    if (!matters.length) return text("No active matters in this account.");
    return text(
      matters
        .map(
          (m) =>
            `${m.title}\n  matterId: ${m.id}\n  ${m._count.documents} document(s), ${m._count.cards} card(s), last touched ${m.updatedAt.toISOString().slice(0, 10)}`
        )
        .join("\n\n")
    );
  }

  const matter = await ownedMatter(userId, args.matterId);
  if (!matter) return text("Matter not found in this account.", true);

  if (name === "search_cards") {
    const q = typeof args.query === "string" ? args.query.trim() : "";
    const limit = Math.min(Math.max(Number(args.limit) || 40, 1), 200);
    const cards = await prisma.card.findMany({
      where: {
        matterId: matter.id,
        ...(args.cardType ? { cardType: String(args.cardType) } : {}),
        ...(q
          ? {
              OR: [
                { quote: { contains: q, mode: "insensitive" as const } },
                { body: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        cardType: true,
        quote: true,
        body: true,
        page: true,
        para: true,
        citation: true,
        eventDate: true,
        sourceUrl: true,
        sourceTitle: true,
        document: { select: { filename: true } },
      },
    });
    if (!cards.length) return text(`No matching cards in "${matter.title}".`);
    return text(
      `${cards.length} card(s) from "${matter.title}":\n\n` +
        cards
          .map((c) => {
            const label = CARD_TYPE_LABEL[c.cardType as CardTypeValue] ?? c.cardType;
            const when = c.eventDate ? ` [${c.eventDate.toISOString().slice(0, 10)}]` : "";
            const note = c.body && c.body !== c.quote ? `\n  note: ${c.body}` : "";
            return `[${label}]${when} "${c.quote}"${note}\n  source: ${cite(c)}`;
          })
          .join("\n\n")
    );
  }

  if (name === "traverse_gaps") {
    const sheet = await prisma.traverseSheet.findUnique({
      where: { matterId: matter.id },
      select: { rows: { orderBy: { order: "asc" }, select: { paraNo: true, paraText: true, status: true } } },
    });
    if (!sheet) {
      return text(
        `No traverse sheet for "${matter.title}". The plaint has to be designated in May or Shall before the paragraphs can be checked.`
      );
    }
    const risky = sheet.rows.filter((r) => AT_RISK.includes(r.status));
    if (!risky.length) {
      return text(
        `All ${sheet.rows.length} paragraph(s) of the plaint in "${matter.title}" carry a specific response. Nothing is exposed under Order VIII Rule 5 CPC.`
      );
    }
    return text(
      `${risky.length} of ${sheet.rows.length} paragraph(s) in "${matter.title}" still lack a specific denial and are liable to be treated as admitted under Order VIII Rule 5 CPC:\n\n` +
        risky
          .map(
            (r) =>
              `Para ${r.paraNo} (${r.status === "NOT_STARTED" ? "no response yet" : "bare denial only"})\n  ${r.paraText.replace(/\s+/g, " ").slice(0, 400)}`
          )
          .join("\n\n")
    );
  }

  if (name === "list_of_dates") {
    const rows = await prisma.chronologyEntry.findMany({
      where: { matterId: matter.id, includeInFiling: true },
      orderBy: [{ eventDate: "asc" }, { sortOrder: "asc" }],
      select: { eventDate: true, description: true },
    });
    if (!rows.length) return text(`No chronology entries in "${matter.title}" yet.`);
    return text(
      `Chronology for "${matter.title}" (${rows.length} entries):\n\n` +
        rows
          .map((r) => {
            const d = r.eventDate;
            const dd = String(d.getUTCDate()).padStart(2, "0");
            const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
            return `${dd}.${mm}.${d.getUTCFullYear()}  ${r.description}`;
          })
          .join("\n")
    );
  }

  if (name === "list_documents") {
    const docs = await prisma.document.findMany({
      where: { matterId: matter.id },
      orderBy: { createdAt: "asc" },
      select: { filename: true, docType: true, pageCount: true, annexureLabel: true, hasTextLayer: true },
    });
    if (!docs.length) return text(`No documents uploaded to "${matter.title}".`);
    return text(
      docs
        .map(
          (d) =>
            `${d.filename} — ${d.docType}, ${d.pageCount} page(s)${d.annexureLabel ? `, ${d.annexureLabel}` : ""}${d.hasTextLayer ? "" : " (scanned, no text layer)"}`
        )
        .join("\n")
    );
  }

  if (name === "save_card") {
    const quote = typeof args.quote === "string" ? args.quote.trim() : "";
    if (!quote) return text("A quote is required to save a card.", true);
    const cardType = CARD_TYPES.includes(args.cardType as CardTypeValue)
      ? String(args.cardType)
      : "MISC";
    const card = await prisma.card.create({
      data: {
        matterId: matter.id,
        cardType,
        quote,
        body: typeof args.note === "string" && args.note.trim() ? args.note.trim() : quote,
        sourceUrl: typeof args.sourceUrl === "string" ? args.sourceUrl.slice(0, 2000) : null,
        sourceTitle: typeof args.sourceTitle === "string" ? args.sourceTitle.slice(0, 300) : null,
      },
      select: { id: true },
    });
    const label = CARD_TYPE_LABEL[cardType as CardTypeValue] ?? cardType;
    return text(`Saved as a ${label} card in "${matter.title}" (id ${card.id}).`);
  }

  return text(`Unknown tool: ${name}`, true);
}

export async function POST(req: NextRequest) {
  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return failure(null, -32700, "Parse error");
  }

  const { id = null, method } = body as { id?: unknown; method?: string };

  // notifications carry no id and expect no reply
  if (typeof method === "string" && method.startsWith("notifications/")) {
    return new NextResponse(null, { status: 202, headers: CORS });
  }

  if (method === "initialize") {
    const asked = (body.params as Json | undefined)?.protocolVersion;
    return result(id, {
      protocolVersion: typeof asked === "string" ? asked : PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "may-or-shall", version: "1.0.0" },
      instructions:
        "May or Shall holds a litigator's matters: passages they chose and typed, each with its citation. Call list_matters first. When drafting, ground every factual sentence in search_cards results and keep their citations. traverse_gaps answers which paragraphs of a plaint are still unanswered under Order VIII Rule 5 CPC.",
    });
  }

  if (method === "ping") return result(id, {});

  if (method === "tools/list") return result(id, { tools: TOOLS });

  if (method === "tools/call") {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return failure(
        id,
        -32001,
        "Not authenticated. Create an API token in May or Shall under Settings, and send it as an Authorization: Bearer header."
      );
    }
    const params = (body.params ?? {}) as { name?: string; arguments?: Json };
    if (!params.name) return failure(id, -32602, "Missing tool name");
    try {
      return result(id, await runTool(userId, params.name, params.arguments ?? {}));
    } catch (e) {
      return result(id, text(`Tool failed: ${(e as Error).message}`, true));
    }
  }

  return failure(id, -32601, `Method not found: ${String(method)}`);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  // Streamable HTTP allows a GET for server-initiated events; this server is
  // stateless and has none, so say so rather than hanging a connection open.
  return NextResponse.json(
    { error: "This MCP endpoint is POST only.", protocolVersion: PROTOCOL_VERSION },
    { status: 405, headers: CORS }
  );
}

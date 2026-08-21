import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/requestUser";
import { CARD_TYPES, CARD_TYPE_LABEL, type CardTypeValue } from "@/lib/labels";
import { origin, resourceUrl, userFromAccessToken } from "@/lib/oauth";

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
// Versions this server will speak. It only does tools over plain JSON-RPC, so
// it is compatible across all of these; echoing back anything a client asks for
// would be claiming support for revisions that do not exist yet.
const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
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

/**
 * search and fetch must return the payload twice: once as structuredContent
 * and once as JSON encoded text. That is ChatGPT's contract for a connector,
 * not a preference of ours.
 */
function structured(payload: Json): Json {
  return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

const TOOLS = [
  {
    // Required, by name and shape, for ChatGPT connectors and deep research.
    name: "search",
    title: "Search the matter file",
    description:
      "Search everything in this May or Shall account: saved cards (passages the lawyer chose, each with its exact quote and citation), matters, and uploaded documents. Returns results to be read with fetch.",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "What to look for." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "fetch",
    title: "Read one result in full",
    description:
      "Retrieve the full text of a result returned by search, by its id. Also accepts traverse:<matterId> for the unanswered paragraphs of a plaint, and chronology:<matterId> for the list of dates.",
    annotations: READ_ONLY,
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "An id from search." } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_matters",
    annotations: READ_ONLY,
    description:
      "List the litigation matters in this May or Shall account, with how many documents and cards each holds. Call this first to find a matterId.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_cards",
    annotations: READ_ONLY,
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
    annotations: READ_ONLY,
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
    annotations: READ_ONLY,
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
    annotations: READ_ONLY,
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
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
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
  // ---- the two tools ChatGPT requires, in the shape it requires ----------

  if (name === "search") {
    const q = typeof args.query === "string" ? args.query.trim() : "";
    const base = origin();
    const results: { id: string; title: string; url: string }[] = [];

    const matters = await prisma.matter.findMany({
      where: { userId, status: "ACTIVE" },
      select: { id: true, title: true },
    });
    const mine = matters.map((m) => m.id);
    const titleOf = new Map(matters.map((m) => [m.id, m.title]));

    if (q) {
      for (const m of matters) {
        if (m.title.toLowerCase().includes(q.toLowerCase())) {
          results.push({ id: `matter:${m.id}`, title: `Matter: ${m.title}`, url: `${base}/matters/${m.id}/cards` });
        }
      }
    }

    const cards = await prisma.card.findMany({
      where: {
        matterId: { in: mine },
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
      take: 20,
      select: { id: true, matterId: true, cardType: true, quote: true, body: true },
    });
    for (const c of cards) {
      const label = CARD_TYPE_LABEL[c.cardType as CardTypeValue] ?? c.cardType;
      const snippet = (c.quote || c.body).replace(/\s+/g, " ").slice(0, 90);
      results.push({
        id: `card:${c.id}`,
        title: `[${label}] ${snippet}${snippet.length === 90 ? "…" : ""} (${titleOf.get(c.matterId) ?? "matter"})`,
        url: `${base}/matters/${c.matterId}/cards`,
      });
    }

    if (q) {
      const docs = await prisma.document.findMany({
        where: { matterId: { in: mine }, filename: { contains: q, mode: "insensitive" } },
        take: 10,
        select: { id: true, matterId: true, filename: true },
      });
      for (const d of docs) {
        results.push({
          id: `document:${d.id}`,
          title: `Document: ${d.filename}`,
          url: `${base}/matters/${d.matterId}/documents`,
        });
      }
    }

    return structured({ results });
  }

  if (name === "fetch") {
    const raw = typeof args.id === "string" ? args.id : "";
    const [kind, refId] = raw.includes(":") ? [raw.slice(0, raw.indexOf(":")), raw.slice(raw.indexOf(":") + 1)] : ["card", raw];
    const base = origin();

    if (kind === "card") {
      const c = await prisma.card.findUnique({
        where: { id: refId },
        select: {
          id: true, matterId: true, cardType: true, quote: true, body: true, page: true,
          para: true, citation: true, eventDate: true, sourceUrl: true, sourceTitle: true,
          matter: { select: { userId: true, title: true } },
          document: { select: { filename: true } },
        },
      });
      if (!c || c.matter.userId !== userId) return text("Not found in this account.", true);
      const label = CARD_TYPE_LABEL[c.cardType as CardTypeValue] ?? c.cardType;
      const lines = [
        `Type: ${label}`,
        `Matter: ${c.matter.title}`,
        c.eventDate ? `Date: ${c.eventDate.toISOString().slice(0, 10)}` : "",
        `Source: ${cite(c)}`,
        "",
        `Quote: "${c.quote}"`,
        c.body && c.body !== c.quote ? `Note: ${c.body}` : "",
      ].filter(Boolean);
      return structured({
        id: raw,
        title: `[${label}] ${c.matter.title}`,
        text: lines.join("\n"),
        url: `${base}/matters/${c.matterId}/cards`,
        metadata: { cardType: c.cardType, matterId: c.matterId },
      });
    }

    const matterId = kind === "document" ? null : refId;
    if (matterId) {
      const m = await ownedMatter(userId, matterId);
      if (!m) return text("Not found in this account.", true);

      if (kind === "traverse") {
        const inner = await runTool(userId, "traverse_gaps", { matterId });
        const body = (inner.content as { text: string }[])[0].text;
        return structured({
          id: raw,
          title: `Unanswered paragraphs — ${m.title}`,
          text: body,
          url: `${base}/matters/${matterId}/traverse`,
        });
      }
      if (kind === "chronology") {
        const inner = await runTool(userId, "list_of_dates", { matterId });
        const body = (inner.content as { text: string }[])[0].text;
        return structured({
          id: raw,
          title: `List of dates — ${m.title}`,
          text: body,
          url: `${base}/matters/${matterId}/chronology`,
        });
      }
      if (kind === "matter") {
        const docs = (await runTool(userId, "list_documents", { matterId })).content as { text: string }[];
        const cards = (await runTool(userId, "search_cards", { matterId, limit: 60 })).content as { text: string }[];
        return structured({
          id: raw,
          title: `Matter: ${m.title}`,
          text: `Documents:\n${docs[0].text}\n\n${cards[0].text}`,
          url: `${base}/matters/${matterId}/cards`,
        });
      }
    }

    if (kind === "document") {
      const d = await prisma.document.findUnique({
        where: { id: refId },
        select: {
          id: true, filename: true, docType: true, pageCount: true, annexureLabel: true,
          matterId: true, matter: { select: { userId: true, title: true } },
        },
      });
      if (!d || d.matter.userId !== userId) return text("Not found in this account.", true);
      return structured({
        id: raw,
        title: d.filename,
        text: `${d.filename}\nType: ${d.docType}\nPages: ${d.pageCount}${d.annexureLabel ? `\nAnnexure: ${d.annexureLabel}` : ""}\nMatter: ${d.matter.title}\n\nOpen the document in May or Shall to read it; the cards saved from it carry the passages that were selected.`,
        url: `${base}/matters/${d.matterId}/documents`,
      });
    }

    return text(`Unrecognised id: ${raw}`, true);
  }

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

/**
 * Two kinds of credential reach this endpoint. An OAuth access token, which is
 * how a connected client (Claude, ChatGPT) authenticates after the user has
 * clicked Allow, and a personal API token, which is how someone wiring up a
 * CLI by hand does it. OAuth is tried first because its tokens are audience
 * bound to this endpoint.
 */
async function resolveUser(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const viaOauth = await userFromAccessToken(header.slice(7).trim(), resourceUrl());
    if (viaOauth) return viaOauth;
  }
  return getRequestUserId(req);
}

/**
 * RFC 9728 requires a 401 carrying the location of the resource metadata, which
 * is how a client discovers where to send the user to authorize. Without this
 * header a client has no way to start the flow on its own.
 */
function unauthenticated() {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32001,
        message:
          "Authorization required. Connect this server from your client to sign in, or send a May or Shall API token as a Bearer header.",
      },
    },
    {
      status: 401,
      headers: {
        ...CORS,
        "WWW-Authenticate": `Bearer resource_metadata="${origin()}/.well-known/oauth-protected-resource/api/mcp"`,
      },
    }
  );
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
    const agreed =
      typeof asked === "string" && SUPPORTED_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSION;
    return result(id, {
      protocolVersion: agreed,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "may-or-shall", version: "1.0.0" },
      instructions:
        "May or Shall holds a litigator's matters: passages they chose and typed, each with its citation. Call list_matters first. When drafting, ground every factual sentence in search_cards results and keep their citations. traverse_gaps answers which paragraphs of a plaint are still unanswered under Order VIII Rule 5 CPC.",
    });
  }

  if (method === "ping") return result(id, {});

  if (method === "tools/list") return result(id, { tools: TOOLS });

  if (method === "tools/call") {
    const userId = await resolveUser(req);
    if (!userId) return unauthenticated();
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

import { NextRequest, NextResponse } from "next/server";
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { DEFAULT_HOUSE_STYLE } from "@/lib/houseStyle";
import { CARD_TYPES, CARD_TYPE_LABEL } from "@/lib/labels";
import { cardOut } from "@/lib/jsonFields";
import { sourceChip } from "@/lib/cardDigest";
import { requireMatterOwner, isResponse } from "@/lib/requestUser";

type Params = { params: { matterId: string } };

/**
 * Every card in the matter as one document — the whole research base, grouped
 * by card type, each card carrying its quote and its source. Word keeps web
 * sources as clickable links; the PDF prints them in full so they survive
 * printing. `?format=pdf` for PDF, otherwise Word.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const owner = await requireMatterOwner(req, params.matterId);
  if (isResponse(owner)) return owner;
  const matter = await prisma.matter.findUnique({ where: { id: params.matterId } });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const rows = await prisma.card.findMany({
    where: { matterId: params.matterId },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    include: { document: { select: { filename: true } } },
  });
  const cards = rows.map(cardOut);

  // group in the canonical card-type order, so the document reads predictably
  const groups = CARD_TYPES.map((type) => ({
    type,
    label: CARD_TYPE_LABEL[type],
    items: cards.filter((c) => c.cardType === type),
  })).filter((g) => g.items.length > 0);

  const safeTitle = matter.title.replace(/[^\w\- ]+/g, "").trim() || "Matter";
  const stamp = format(new Date(), "d MMMM yyyy");
  const wantsPdf = (req.nextUrl.searchParams.get("format") || "").toLowerCase() === "pdf";

  const meta = (c: (typeof cards)[number]) => {
    const bits: string[] = [];
    if (c.eventDate) bits.push(format(new Date(c.eventDate), "dd.MM.yyyy"));
    if (c.tags.length) bits.push(c.tags.map((t) => `#${t}`).join(" "));
    return bits.join("  ·  ");
  };

  if (wantsPdf) {
    const pdf = await buildPdf({ title: matter.title, stamp, groups, meta, total: cards.length });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Cards - ${safeTitle}.pdf"`,
      },
    });
  }

  const style = DEFAULT_HOUSE_STYLE;
  const size = style.fontSizePt * 2;
  const run = (text: string, o: { bold?: boolean; italics?: boolean; color?: string } = {}) =>
    new TextRun({ text, font: style.font, size, ...o });

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [run(matter.title, { bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        run(`Cards — ${cards.length} in total · exported ${stamp}`, { italics: true, color: "666666" }),
      ],
    }),
  ];

  if (groups.length === 0) {
    children.push(new Paragraph({ children: [run("This matter has no cards yet.", { italics: true })] }));
  }

  for (const g of groups) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
        children: [run(`${g.label.toUpperCase()} (${g.items.length})`, { bold: true })],
      })
    );
    g.items.forEach((c, i) => {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: Math.round(style.lineSpacing * 240), before: 160 },
          children: [run(`${i + 1}. `, { bold: true }), run(c.body || c.quote)],
        })
      );
      if (c.quote && c.quote !== c.body) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { left: 720 },
            spacing: { line: Math.round(style.lineSpacing * 240) },
            children: [run(`“${c.quote}”`, { italics: true })],
          })
        );
      }
      // source: a real hyperlink for web clips, plain citation for documents
      if (c.sourceUrl) {
        children.push(
          new Paragraph({
            indent: { left: 720 },
            children: [
              run("Source: ", { italics: true, color: "666666" }),
              ...(c.sourceTitle ? [run(`${c.sourceTitle} — `, { italics: true, color: "666666" })] : []),
              new ExternalHyperlink({
                link: c.sourceUrl,
                children: [
                  new TextRun({
                    text: c.sourceUrl,
                    font: style.font,
                    size: size - 4,
                    color: "0563C1",
                    underline: {},
                  }),
                ],
              }),
            ],
          })
        );
      } else {
        const chip = sourceChip(c as never);
        if (chip) {
          children.push(
            new Paragraph({
              indent: { left: 720 },
              children: [run(`Source: ${chip}`, { italics: true, color: "666666" })],
            })
          );
        }
      }
      const m = meta(c);
      if (m) {
        children.push(
          new Paragraph({
            indent: { left: 720 },
            children: [run(m, { italics: true, color: "999999" })],
          })
        );
      }
    });
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: style.font, size } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: style.margins },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Cards - ${safeTitle}.docx"`,
    },
  });
}

/* ---------------------------------------------------------------- PDF ---- */

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 56;

type Group = { label: string; items: { body: string; quote: string; sourceUrl: string | null; sourceTitle: string | null; document?: { filename: string } | null; page?: number | null; para?: string | null }[] };

async function buildPdf(opts: {
  title: string;
  stamp: string;
  groups: { label: string; items: never[] }[] | Group[];
  meta: (c: never) => string;
  total: number;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;

  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    y = A4.h - MARGIN;
  };

  /** Wraps to the page width and paginates; returns nothing, advances y. */
  const write = (
    text: string,
    o: { size?: number; f?: typeof font; indent?: number; gap?: number; color?: ReturnType<typeof rgb> } = {}
  ) => {
    const size = o.size ?? 11;
    const f = o.f ?? font;
    const indent = o.indent ?? 0;
    const maxW = A4.w - MARGIN * 2 - indent;
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    const flush = () => {
      if (!line) return;
      if (y < MARGIN + size) newPage();
      page.drawText(line, { x: MARGIN + indent, y, size, font: f, color: o.color ?? rgb(0.1, 0.1, 0.1) });
      y -= size * 1.45;
      line = "";
    };
    for (const w of words) {
      // break words too long to fit (long URLs) rather than overflow the page
      if (f.widthOfTextAtSize(w, size) > maxW) {
        flush();
        let chunk = "";
        for (const ch of w) {
          if (f.widthOfTextAtSize(chunk + ch, size) > maxW) {
            line = chunk;
            flush();
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
        continue;
      }
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > maxW) flush();
      line = line ? (f.widthOfTextAtSize(next, size) > maxW ? w : next) : w;
    }
    flush();
    y -= o.gap ?? 0;
  };

  write(opts.title, { size: 18, f: bold, gap: 4 });
  write(`Cards — ${opts.total} in total · exported ${opts.stamp}`, {
    size: 10,
    f: italic,
    gap: 12,
    color: rgb(0.4, 0.4, 0.4),
  });

  if (opts.groups.length === 0) {
    write("This matter has no cards yet.", { size: 11, f: italic });
  }

  for (const g of opts.groups as Group[]) {
    if (y < MARGIN + 80) newPage();
    write(`${g.label.toUpperCase()} (${g.items.length})`, { size: 13, f: bold, gap: 6 });
    g.items.forEach((c, i) => {
      write(`${i + 1}. ${c.body || c.quote}`, { size: 11, gap: 2 });
      if (c.quote && c.quote !== c.body) {
        write(`“${c.quote}”`, { size: 10.5, f: italic, indent: 18, gap: 2 });
      }
      const src = c.sourceUrl
        ? `Source: ${c.sourceTitle ? `${c.sourceTitle} — ` : ""}${c.sourceUrl}`
        : sourceChip(c as never)
          ? `Source: ${sourceChip(c as never)}`
          : "";
      if (src) write(src, { size: 9.5, f: italic, indent: 18, color: rgb(0.35, 0.35, 0.35) });
      const m = opts.meta(c as never);
      if (m) write(m, { size: 9, f: italic, indent: 18, color: rgb(0.55, 0.55, 0.55) });
      y -= 6;
    });
  }

  return pdf.save();
}

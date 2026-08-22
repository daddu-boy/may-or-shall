import { NextRequest, NextResponse } from "next/server";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { DEFAULT_HOUSE_STYLE } from "@/lib/houseStyle";
import {
  CARD_TYPE_LABEL,
  LINK_KIND_LABEL,
  type CardTypeValue,
  type LinkKindValue,
} from "@/lib/labels";
import { requireMatterOwner, isResponse } from "@/lib/requestUser";

type Params = { params: { matterId: string } };

/**
 * Every link in the matter as one document: your note, then the two passages
 * it joins with their citations. The note leads because it is the reasoning;
 * the relation is only its category. `?format=pdf` for PDF, otherwise Word.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const owner = await requireMatterOwner(req, params.matterId);
  if (isResponse(owner)) return owner;
  const matter = await prisma.matter.findUnique({ where: { id: params.matterId } });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const links = await prisma.cardLink.findMany({
    where: { matterId: params.matterId },
    orderBy: { createdAt: "asc" },
    include: {
      fromCard: { include: { document: { select: { filename: true, annexureLabel: true } } } },
      toCard: { include: { document: { select: { filename: true, annexureLabel: true } } } },
    },
  });

  type Side = (typeof links)[number]["fromCard"];
  const cite = (c: Side) => {
    if (c.document) {
      const bits = [c.document.annexureLabel, c.document.filename].filter(Boolean).join(" · ");
      const where = [c.page ? `p.${c.page}` : "", c.para ? `para ${c.para}` : ""]
        .filter(Boolean)
        .join(", ");
      return where ? `${bits}, ${where}` : bits;
    }
    return c.sourceTitle || c.sourceUrl || "no source recorded";
  };
  const label = (c: Side) => CARD_TYPE_LABEL[c.cardType as CardTypeValue] ?? c.cardType;

  const safeTitle = matter.title.replace(/[^\w\- ]+/g, "").trim() || "Matter";
  const stamp = format(new Date(), "d MMMM yyyy");
  const wantsPdf = (req.nextUrl.searchParams.get("format") || "").toLowerCase() === "pdf";

  if (wantsPdf) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.TimesRoman);
    const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
    const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
    const A4: [number, number] = [595.28, 841.89];
    const margin = 56;
    let page = doc.addPage(A4);
    let y = A4[1] - margin;

    const wrap = (text: string, f: typeof font, size: number, width: number) => {
      const out: string[] = [];
      let line = "";
      for (const word of text.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(next, size) > width && line) {
          out.push(line);
          line = word;
        } else line = next;
      }
      if (line) out.push(line);
      return out;
    };

    const write = (
      text: string,
      f: typeof font,
      size: number,
      opts: { indent?: number; gap?: number; colour?: ReturnType<typeof rgb> } = {}
    ) => {
      const indent = opts.indent ?? 0;
      for (const line of wrap(text, f, size, A4[0] - margin * 2 - indent)) {
        if (y < margin + size * 2) {
          page = doc.addPage(A4);
          y = A4[1] - margin;
        }
        page.drawText(line, {
          x: margin + indent,
          y,
          size,
          font: f,
          color: opts.colour ?? rgb(0.1, 0.1, 0.12),
        });
        y -= size * 1.45;
      }
      y -= opts.gap ?? 0;
    };

    write(matter.title, bold, 16, { gap: 4 });
    write(`Links — ${links.length} in total · exported ${stamp}`, italic, 10, { gap: 14 });

    if (links.length === 0) write("This matter has no links yet.", italic, 11);

    links.forEach((l, i) => {
      write(`${i + 1}.`, bold, 11, { gap: 2 });
      if (l.note) write(l.note, bold, 12, { indent: 16, gap: 6 });
      write(`[${label(l.fromCard)}] "${l.fromCard.quote || l.fromCard.body}"`, font, 11, {
        indent: 16,
      });
      write(cite(l.fromCard), italic, 9.5, { indent: 16, gap: 4, colour: rgb(0.42, 0.42, 0.46) });
      write(LINK_KIND_LABEL[l.kind as LinkKindValue] ?? l.kind, italic, 10, {
        indent: 16,
        gap: 4,
        colour: rgb(0.42, 0.42, 0.46),
      });
      write(`[${label(l.toCard)}] "${l.toCard.quote || l.toCard.body}"`, font, 11, { indent: 16 });
      write(cite(l.toCard), italic, 9.5, { indent: 16, gap: 16, colour: rgb(0.42, 0.42, 0.46) });
    });

    const bytes = await doc.save();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Links - ${safeTitle}.pdf"`,
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
        run(`Links — ${links.length} in total · exported ${stamp}`, {
          italics: true,
          color: "666666",
        }),
      ],
    }),
  ];

  if (links.length === 0) {
    children.push(new Paragraph({ children: [run("This matter has no links yet.", { italics: true })] }));
  }

  links.forEach((l, i) => {
    if (l.note) {
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [run(`${i + 1}.  ${l.note}`, { bold: true })],
        })
      );
    } else {
      children.push(
        new Paragraph({ spacing: { before: 200, after: 80 }, children: [run(`${i + 1}.`, { bold: true })] })
      );
    }
    children.push(
      new Paragraph({
        indent: { left: 360 },
        children: [run(`[${label(l.fromCard)}] "${l.fromCard.quote || l.fromCard.body}"`)],
      }),
      new Paragraph({
        indent: { left: 360 },
        spacing: { after: 60 },
        children: [run(cite(l.fromCard), { italics: true, color: "666666" })],
      }),
      new Paragraph({
        indent: { left: 360 },
        spacing: { after: 60 },
        children: [
          run(LINK_KIND_LABEL[l.kind as LinkKindValue] ?? l.kind, { italics: true, color: "666666" }),
        ],
      }),
      new Paragraph({
        indent: { left: 360 },
        children: [run(`[${label(l.toCard)}] "${l.toCard.quote || l.toCard.body}"`)],
      }),
      new Paragraph({
        indent: { left: 360 },
        spacing: { after: 120 },
        children: [run(cite(l.toCard), { italics: true, color: "666666" })],
      })
    );
  });

  const docx = new Document({
    sections: [{ properties: { page: { margin: style.margins } }, children }],
  });
  const buf = await Packer.toBuffer(docx);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Links - ${safeTitle}.docx"`,
    },
  });
}

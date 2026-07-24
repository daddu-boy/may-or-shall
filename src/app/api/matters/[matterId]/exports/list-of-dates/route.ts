import { NextRequest, NextResponse } from "next/server";
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { DEFAULT_HOUSE_STYLE } from "@/lib/houseStyle";
import { requireMatterOwner, isResponse } from "@/lib/requestUser";

type Params = { params: { matterId: string } };

/**
 * List of Dates and Events as a Word document (PRD F4): conventional
 * two-column format, DD.MM.YYYY dates, synopsis placeholder on top for
 * Supreme Court style filings, house-standard Times New Roman 14.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const owner = await requireMatterOwner(req, params.matterId);
  if (isResponse(owner)) return owner;
  const matter = await prisma.matter.findUnique({ where: { id: params.matterId } });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const entries = await prisma.chronologyEntry.findMany({
    where: { matterId: params.matterId, includeInFiling: true },
    orderBy: [{ eventDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const style = DEFAULT_HOUSE_STYLE;
  const sizeHalfPt = style.fontSizePt * 2;

  const run = (text: string, opts: { bold?: boolean; italics?: boolean } = {}) =>
    new TextRun({ text, font: style.font, size: sizeHalfPt, ...opts });

  const para = (text: string, opts: { bold?: boolean; italics?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
    new Paragraph({
      alignment: opts.align ?? AlignmentType.JUSTIFIED,
      spacing: { line: Math.round(style.lineSpacing * 240), after: 120 },
      children: [run(text, opts)],
    });

  const headerCell = (text: string, width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [run(text, { bold: true })],
        }),
      ],
    });

  const bodyCell = (children: Paragraph[], width: number) =>
    new TableCell({ width: { size: width, type: WidthType.PERCENTAGE }, children });

  const rows = [
    new TableRow({ tableHeader: true, children: [headerCell("Date", 22), headerCell("Event", 78)] }),
    ...entries.map(
      (e) =>
        new TableRow({
          children: [
            bodyCell(
              [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [run(format(e.eventDate, "dd.MM.yyyy"))],
                }),
              ],
              22
            ),
            bodyCell(
              [
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: { line: Math.round(style.lineSpacing * 240) },
                  children: [run(e.description)],
                }),
              ],
              78
            ),
          ],
        })
    ),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: style.font, size: sizeHalfPt } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 in twips
            margin: style.margins,
          },
        },
        children: [
          para("SYNOPSIS", { bold: true, align: AlignmentType.CENTER }),
          para("[Insert synopsis of the case here.]", { italics: true }),
          new Paragraph({ children: [] }),
          para("LIST OF DATES AND EVENTS", { bold: true, align: AlignmentType.CENTER }),
          new Paragraph({ children: [] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const safeTitle = matter.title.replace(/[^\w\- ]+/g, "").trim() || "Matter";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="List of Dates - ${safeTitle}.docx"`,
    },
  });
}

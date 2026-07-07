import { NextRequest, NextResponse } from "next/server";
import {
  AlignmentType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
} from "docx";
import { prisma } from "@/lib/db";
import { run, styledDoc } from "@/lib/docxUtils";

type Params = { params: { matterId: string } };

/** Index of Annexures document (PRD F8). */
export async function GET(_req: NextRequest, { params }: Params) {
  const matter = await prisma.matter.findUnique({ where: { id: params.matterId } });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const items = await prisma.annexureItem.findMany({
    where: { matterId: params.matterId },
    orderBy: { position: "asc" },
  });
  const docs = await prisma.document.findMany({
    where: { id: { in: items.map((i) => i.documentId) } },
    select: { id: true, filename: true, annexureLabel: true, pageCount: true },
  });
  const byId = new Map(docs.map((d) => [d.id, d]));

  const cell = (text: string, width: number, bold = false, center = false) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [run(text, { bold })],
        }),
      ],
    });

  const rows = [
    new TableRow({
      tableHeader: true,
      children: [cell("Annexure", 25, true, true), cell("Description", 60, true, true), cell("Pages", 15, true, true)],
    }),
    ...items.map((item) => {
      const doc = byId.get(item.documentId);
      return new TableRow({
        children: [
          cell(doc?.annexureLabel ?? "—", 25, false, true),
          cell(doc?.filename.replace(/\.pdf$/i, "") ?? "(document removed)", 60),
          cell(doc ? String(doc.pageCount) : "—", 15, false, true),
        ],
      });
    }),
  ];

  const doc = styledDoc([
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [run("INDEX OF ANNEXURES", { bold: true })],
    }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
  ]);

  const buffer = await Packer.toBuffer(doc);
  const safeTitle = matter.title.replace(/[^\w\- ]+/g, "").trim() || "Matter";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Index of Annexures - ${safeTitle}.docx"`,
    },
  });
}

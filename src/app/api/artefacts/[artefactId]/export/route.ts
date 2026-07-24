import { NextRequest, NextResponse } from "next/server";
import { AlignmentType, Packer, Paragraph } from "docx";
import { prisma } from "@/lib/db";
import { htmlToParagraphs, run, styledDoc } from "@/lib/docxUtils";
import { requireResourceOwner, isResponse } from "@/lib/requestUser";

type Params = { params: { artefactId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const owner = await requireResourceOwner(req, () => prisma.generatedArtefact.findUnique({ where: { id: params.artefactId }, select: { matterId: true } }).then((r) => r?.matterId ?? null));
  if (isResponse(owner)) return owner;
  const artefact = await prisma.generatedArtefact.findUnique({
    where: { id: params.artefactId },
    include: { matter: { select: { title: true } } },
  });
  if (!artefact) return NextResponse.json({ error: "Artefact not found" }, { status: 404 });

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [run(artefact.title.toUpperCase(), { bold: true })],
    }),
    ...htmlToParagraphs(artefact.content),
  ];

  const buffer = await Packer.toBuffer(styledDoc(children));
  const safeTitle = `${artefact.title} v${artefact.version}`.replace(/[^\w\- ]+/g, "").trim();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeTitle}.docx"`,
    },
  });
}

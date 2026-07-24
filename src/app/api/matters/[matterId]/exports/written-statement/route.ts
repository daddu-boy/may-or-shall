import { NextRequest, NextResponse } from "next/server";
import { AlignmentType, Packer, Paragraph } from "docx";
import { prisma } from "@/lib/db";
import { heading, htmlToParagraphs, run, styledDoc } from "@/lib/docxUtils";
import { DEFAULT_HOUSE_STYLE } from "@/lib/houseStyle";
import { requireMatterOwner, isResponse } from "@/lib/requestUser";

type Params = { params: { matterId: string } };

const STATUS_FALLBACK: Record<string, string> = {
  NOT_STARTED:
    "[No reply drafted. The contents of this paragraph are denied for want of a specific traverse — DRAFT PENDING.]",
  DENIED_BARE: "The contents of this paragraph are denied.",
  ADMITTED: "The contents of this paragraph are admitted.",
  ADMITTED_PARTLY: "The contents of this paragraph are admitted in part, as set out hereinafter.",
  LEGAL_OBJECTION: "The contents of this paragraph raise questions of law and call for no reply.",
  DENIED_SPECIFIC: "The contents of this paragraph are denied.",
};

/**
 * Written statement skeleton from the traverse sheet (PRD F5): preliminary
 * objections placeholder, para-wise reply assembled from rows, verification
 * block placeholder. Para numbering stays aligned with the plaint.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const owner = await requireMatterOwner(req, params.matterId);
  if (isResponse(owner)) return owner;
  const matter = await prisma.matter.findUnique({ where: { id: params.matterId } });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const sheet = await prisma.traverseSheet.findUnique({
    where: { matterId: params.matterId },
    include: { rows: { orderBy: { order: "asc" } } },
  });
  if (!sheet) return NextResponse.json({ error: "No traverse sheet for this matter" }, { status: 404 });

  const lineSpacing = Math.round(DEFAULT_HOUSE_STYLE.lineSpacing * 240);
  const para = (text: string, opts: { bold?: boolean; italics?: boolean; center?: boolean } = {}) =>
    new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
      spacing: { line: lineSpacing, after: 120 },
      children: [run(text, opts)],
    });

  const children: Paragraph[] = [
    para(matter.court.toUpperCase() || "[COURT]", { bold: true, center: true }),
    para(matter.caseNumber || "[CASE NUMBER]", { center: true }),
    para(matter.parties || "[PARTIES]", { center: true }),
    para("", {}),
    para("WRITTEN STATEMENT ON BEHALF OF THE DEFENDANT", { bold: true, center: true }),
    para("", {}),
    heading("PRELIMINARY OBJECTIONS"),
    para("[Insert preliminary objections.]", { italics: true }),
    heading("PARA-WISE REPLY"),
  ];

  for (const row of sheet.rows) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: lineSpacing, before: 160, after: 60 },
        children: [run(`Re para ${row.paraNo} of the plaint:`, { bold: true })],
      })
    );
    const body = row.responseText.trim()
      ? htmlToParagraphs(row.responseText)
      : [para(STATUS_FALLBACK[row.status] ?? STATUS_FALLBACK.NOT_STARTED, {
          italics: row.status === "NOT_STARTED",
        })];
    children.push(...body);
  }

  children.push(
    heading("VERIFICATION"),
    para(
      "[Verified at ____ on this ____ day of ____, that the contents of the above written statement are true and correct to my knowledge and belief.]",
      { italics: true }
    )
  );

  const buffer = await Packer.toBuffer(styledDoc(children));
  const safeTitle = matter.title.replace(/[^\w\- ]+/g, "").trim() || "Matter";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Written Statement - ${safeTitle}.docx"`,
    },
  });
}

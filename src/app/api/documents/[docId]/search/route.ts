import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireResourceOwner, isResponse } from "@/lib/requestUser";

type Params = { params: { docId: string } };

/** Text search within a single document, used by the reader's find box. */
export async function GET(req: NextRequest, { params }: Params) {
  const owner = await requireResourceOwner(req, () => prisma.document.findUnique({ where: { id: params.docId }, select: { matterId: true } }).then((r) => r?.matterId ?? null));
  if (isResponse(owner)) return owner;
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json([]);

  const hits = await prisma.documentPage.findMany({
    where: { documentId: params.docId, text: { contains: q } },
    orderBy: { page: "asc" },
    select: { page: true, text: true },
    take: 100,
  });

  return NextResponse.json(
    hits.map((h) => {
      const idx = h.text.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, idx - 50);
      return {
        page: h.page,
        snippet: h.text.slice(start, idx + q.length + 50).replace(/\s+/g, " "),
      };
    })
  );
}

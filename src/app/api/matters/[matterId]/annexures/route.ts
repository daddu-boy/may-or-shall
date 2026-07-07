import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { derivePrefix, renumberAnnexures } from "@/lib/annexures";

type Params = { params: { matterId: string } };

async function registry(matterId: string) {
  const matter = await prisma.matter.findUnique({ where: { id: matterId } });
  const items = await prisma.annexureItem.findMany({
    where: { matterId },
    orderBy: { position: "asc" },
  });
  const docs = await prisma.document.findMany({
    where: { id: { in: items.map((i) => i.documentId) } },
    select: { id: true, filename: true, annexureLabel: true, pageCount: true },
  });
  const byId = new Map(docs.map((d) => [d.id, d]));
  return {
    prefix: matter ? derivePrefix(matter) : "A",
    items: items.map((item) => ({ ...item, document: byId.get(item.documentId) ?? null })),
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  return NextResponse.json(await registry(params.matterId));
}

const postSchema = z.object({ documentId: z.string().min(1) });

/** Add a document to the registry at the end (labels recomputed). */
export async function POST(req: NextRequest, { params }: Params) {
  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const doc = await prisma.document.findUnique({ where: { id: parsed.data.documentId } });
  if (!doc || doc.matterId !== params.matterId) {
    return NextResponse.json({ error: "Document not found in this matter" }, { status: 404 });
  }
  const existing = await prisma.annexureItem.findUnique({
    where: { documentId: parsed.data.documentId },
  });
  if (existing) {
    return NextResponse.json({ error: "Document is already in the registry" }, { status: 409 });
  }
  const last = await prisma.annexureItem.findFirst({
    where: { matterId: params.matterId },
    orderBy: { position: "desc" },
  });
  await prisma.annexureItem.create({
    data: {
      matterId: params.matterId,
      documentId: parsed.data.documentId,
      position: (last?.position ?? 0) + 1,
    },
  });
  await renumberAnnexures(params.matterId);
  return NextResponse.json(await registry(params.matterId), { status: 201 });
}

const reorderSchema = z.object({ order: z.array(z.string()).min(1) });

/** Reorder: renumbers labels and updates all live references (PRD F8). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const parsed = reorderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  // Two-phase update to dodge the (matterId, position) collisions mid-reorder.
  for (let i = 0; i < parsed.data.order.length; i++) {
    await prisma.annexureItem.updateMany({
      where: { id: parsed.data.order[i], matterId: params.matterId },
      data: { position: 1000 + i },
    });
  }
  await renumberAnnexures(params.matterId);
  return NextResponse.json(await registry(params.matterId));
}

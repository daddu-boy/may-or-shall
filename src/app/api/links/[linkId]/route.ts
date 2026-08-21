import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireResourceOwner, isResponse } from "@/lib/requestUser";
import { LINK_KINDS } from "@/lib/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const matterOf = (linkId: string) => async () =>
  (await prisma.cardLink.findUnique({ where: { id: linkId }, select: { matterId: true } }))
    ?.matterId ?? null;

/** Change a link's kind or note, or accept a suggested one by confirming it. */
export async function PATCH(req: NextRequest, { params }: { params: { linkId: string } }) {
  const owner = await requireResourceOwner(req, matterOf(params.linkId));
  if (isResponse(owner)) return owner;

  const body = await req.json().catch(() => ({}));
  const data: { kind?: string; note?: string; suggested?: boolean } = {};
  if (LINK_KINDS.includes(body?.kind)) data.kind = body.kind;
  if (typeof body?.note === "string") data.note = body.note.slice(0, 500);
  if (body?.accept === true) data.suggested = false;

  const link = await prisma.cardLink.update({ where: { id: params.linkId }, data });
  return NextResponse.json(link);
}

export async function DELETE(req: NextRequest, { params }: { params: { linkId: string } }) {
  const owner = await requireResourceOwner(req, matterOf(params.linkId));
  if (isResponse(owner)) return owner;

  await prisma.cardLink.delete({ where: { id: params.linkId } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

type Params = { params: { artefactId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const artefact = await prisma.generatedArtefact.findUnique({ where: { id: params.artefactId } });
  if (!artefact) return NextResponse.json({ error: "Artefact not found" }, { status: 404 });
  return NextResponse.json(artefact);
}

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const artefact = await prisma.generatedArtefact.update({
    where: { id: params.artefactId },
    data: parsed.data,
  });
  return NextResponse.json(artefact);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await prisma.generatedArtefact.delete({ where: { id: params.artefactId } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { aiUnavailableReason } from "@/lib/ai";
import {
  GENERATABLE_TYPES,
  generateArtefactContent,
  type GeneratableType,
} from "@/lib/artefactGeneration";

export const maxDuration = 300;

type Params = { params: { artefactId: string } };

/** Regeneration creates a new version, never overwrites (PRD F6 acceptance). */
export async function POST(req: NextRequest, { params }: Params) {
  const body = z
    .object({ issues: z.array(z.string()).default([]) })
    .safeParse(await req.json().catch(() => ({})));
  const issues = body.success ? body.data.issues : [];

  const source = await prisma.generatedArtefact.findUnique({
    where: { id: params.artefactId },
    include: { matter: true },
  });
  if (!source) return NextResponse.json({ error: "Artefact not found" }, { status: 404 });
  if (!(source.artefactType in GENERATABLE_TYPES)) {
    return NextResponse.json({ error: "This artefact type cannot be regenerated" }, { status: 400 });
  }

  const reason = aiUnavailableReason(source.matter.aiEnabled);
  if (reason) return NextResponse.json({ error: reason }, { status: 503 });

  try {
    const generated = await generateArtefactContent(
      source.matter,
      source.artefactType as GeneratableType,
      issues
    );
    const latest = await prisma.generatedArtefact.findFirst({
      where: { matterId: source.matterId, artefactType: source.artefactType, title: source.title },
      orderBy: { version: "desc" },
    });
    const artefact = await prisma.generatedArtefact.create({
      data: {
        matterId: source.matterId,
        artefactType: source.artefactType,
        title: source.title,
        content: generated.html,
        promptSnapshot: generated.promptSnapshot,
        version: (latest?.version ?? source.version) + 1,
      },
    });
    return NextResponse.json(artefact, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

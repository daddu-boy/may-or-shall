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

type Params = { params: { matterId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const artefacts = await prisma.generatedArtefact.findMany({
    where: { matterId: params.matterId },
    orderBy: [{ artefactType: "asc" }, { version: "desc" }],
    select: {
      id: true, artefactType: true, title: true, version: true,
      createdAt: true, updatedAt: true,
    },
  });
  return NextResponse.json(artefacts);
}

const createSchema = z.object({
  artefactType: z.enum(["SENIOR_BRIEF", "WRITTEN_SUBMISSIONS", "JUDGE_NOTE"]),
  mode: z.enum(["generate", "blank"]).default("generate"),
  issues: z.array(z.string()).default([]),
  title: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const matter = await prisma.matter.findUnique({ where: { id: params.matterId } });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const { artefactType, mode, issues } = parsed.data;
  const defaultTitle = GENERATABLE_TYPES[artefactType as GeneratableType].title;
  const title = parsed.data.title?.trim() || defaultTitle;

  let content = "";
  let promptSnapshot = "";
  if (mode === "generate") {
    const reason = aiUnavailableReason(matter.aiEnabled);
    if (reason) return NextResponse.json({ error: reason }, { status: 503 });
    try {
      const generated = await generateArtefactContent(matter, artefactType as GeneratableType, issues);
      content = generated.html;
      promptSnapshot = generated.promptSnapshot;
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  const latest = await prisma.generatedArtefact.findFirst({
    where: { matterId: params.matterId, artefactType, title },
    orderBy: { version: "desc" },
  });

  const artefact = await prisma.generatedArtefact.create({
    data: {
      matterId: params.matterId,
      artefactType,
      title,
      content,
      promptSnapshot,
      version: (latest?.version ?? 0) + 1,
    },
  });
  return NextResponse.json(artefact, { status: 201 });
}

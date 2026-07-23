import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/apiAuth";
import { getRequestUserId, unauthorized } from "@/lib/requestUser";

export async function GET(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();
  const tokens = await prisma.apiToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true, revokedAt: true },
  });
  return NextResponse.json(tokens);
}

const createSchema = z.object({ name: z.string().min(1).max(64) });

/** Create a token. The plaintext is returned once and never stored. */
export async function POST(req: NextRequest) {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const token = generateToken();
  const record = await prisma.apiToken.create({
    data: { name: parsed.data.name, tokenHash: hashToken(token), userId },
  });
  return NextResponse.json(
    { id: record.id, name: record.name, token, createdAt: record.createdAt },
    { status: 201 }
  );
}

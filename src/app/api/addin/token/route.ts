import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/apiAuth";
import { hashCode, identifierFor, normaliseCode } from "@/lib/addinCode";

const schema = z.object({ email: z.string().email(), code: z.string().min(4).max(32) });

const ADDIN_TOKEN_NAME = "Word add-in";

/**
 * Step 2: exchange the emailed code for an API token the pane stores.
 * The code is single-use — it is deleted whether or not the exchange succeeds
 * beyond this point, so a code can never be replayed.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the code from your email." }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const code = normaliseCode(parsed.data.code);
  const identifier = identifierFor(email);

  const record = await prisma.verificationToken.findFirst({
    where: { identifier, token: hashCode(email, code) },
  });
  if (!record) {
    return NextResponse.json({ error: "That code is not right. Check and try again." }, { status: 401 });
  }

  // single use, expired or not
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  if (record.expires.getTime() < Date.now()) {
    return NextResponse.json({ error: "That code has expired. Send a new one." }, { status: 401 });
  }

  // same accounts as the web app: sign in if known, sign up if not
  const user = await prisma.user.upsert({
    where: { email },
    update: { emailVerified: new Date() },
    create: { email, emailVerified: new Date() },
    select: { id: true },
  });

  await prisma.apiToken.updateMany({
    where: { userId: user.id, name: ADDIN_TOKEN_NAME, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const token = generateToken();
  await prisma.apiToken.create({
    data: { name: ADDIN_TOKEN_NAME, tokenHash: hashToken(token), userId: user.id },
  });

  return NextResponse.json({ token });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  CODE_TTL_MS,
  generateCode,
  hashCode,
  identifierFor,
  sendCodeEmail,
} from "@/lib/addinCode";

const schema = z.object({ email: z.string().email() });

/**
 * Step 1 of signing the Word task pane in: email a short code.
 * Always answers 200 so this can't be used to discover who has an account.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const identifier = identifierFor(email);

  // only one live code per address
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  const code = generateCode();
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: hashCode(email, code),
      expires: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  try {
    await sendCodeEmail(email, code);
  } catch {
    return NextResponse.json(
      { error: "Could not send the email. Please try again." },
      { status: 502 }
    );
  }
  return NextResponse.json({ sent: true });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/apiAuth";

/**
 * Auto-connect endpoint for the Chrome extension / Word add-in.
 *
 * The extension calls this from a May or Shall page (same-origin), so the
 * browser sends the logged-in session cookie. We mint a fresh API token for
 * that user and return it plus their active matters — the extension stores the
 * token and is instantly connected, with no manual token-copying. Being signed
 * into the web app IS the connection.
 *
 * Previous auto-issued tokens are revoked on each call so a user accumulates at
 * most one "Chrome extension" token.
 */
const EXT_TOKEN_NAME = "Chrome extension";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // rotate: revoke prior auto-issued extension tokens for this user
  await prisma.apiToken.updateMany({
    where: { userId, name: EXT_TOKEN_NAME, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const token = generateToken();
  await prisma.apiToken.create({
    data: { name: EXT_TOKEN_NAME, tokenHash: hashToken(token), userId },
  });

  const matters = await prisma.matter.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });

  return NextResponse.json({ token, email: session.user?.email ?? null, matters });
}

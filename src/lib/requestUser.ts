import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "./db";
import { hashToken } from "./apiAuth";

/**
 * Every API request acts as exactly one user, resolved from either:
 *  - a Bearer API token (extension / Word add-in), or
 *  - the browser session cookie (Auth.js).
 * Returns the userId, or null if neither is valid.
 */
export async function getRequestUserId(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    const rec = await prisma.apiToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (!rec || rec.revokedAt) return null;
    prisma.apiToken
      .update({ where: { id: rec.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
    return rec.userId;
  }
  const session = await auth();
  return session?.user?.id ?? null;
}

/** 401 JSON response for unauthenticated requests. */
export function unauthorized() {
  return NextResponse.json({ error: "Sign in required" }, { status: 401 });
}

/** 404 (not 403, so we don't reveal that another user's resource exists). */
export function notFound(what = "Not found") {
  return NextResponse.json({ error: what }, { status: 404 });
}

/**
 * Resolve the user and confirm they own `matterId`. Returns the userId on
 * success, or a NextResponse (401/404) to return directly.
 */
export async function requireMatterOwner(
  req: NextRequest,
  matterId: string
): Promise<string | NextResponse> {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { userId: true },
  });
  if (!matter || matter.userId !== userId) return notFound("Matter not found");
  return userId;
}

/** True when the value returned by requireMatterOwner is an error response. */
export function isResponse(v: string | NextResponse): v is NextResponse {
  return typeof v !== "string";
}

/**
 * Confirm the signed-in user owns the matter that a nested resource belongs to.
 * `lookupMatterId` fetches the resource's matterId (or null if it doesn't exist).
 */
export async function requireResourceOwner(
  req: NextRequest,
  lookupMatterId: () => Promise<string | null>
): Promise<string | NextResponse> {
  const userId = await getRequestUserId(req);
  if (!userId) return unauthorized();
  const matterId = await lookupMatterId();
  if (!matterId) return notFound();
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { userId: true },
  });
  if (!matter || matter.userId !== userId) return notFound();
  return userId;
}

import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./db";

/**
 * Bearer-token auth for cross-origin clients (browser extension, remote
 * add-ins). The pilot web app itself stays session-less behind the firm VPN
 * (PRD §8); tokens identify the extension/add-in clients.
 *
 * Enforcement: a presented token is always validated (bad token = 401).
 * When API_REQUIRE_TOKEN=1, requests that are neither same-origin browser
 * traffic nor token-bearing are rejected — the deployment switch for when
 * the backend is exposed beyond localhost.
 */

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return `mos_${randomBytes(24).toString("hex")}`;
}

/** Returns an error response to short-circuit with, or null to proceed. */
export async function checkApiAuth(req: NextRequest): Promise<NextResponse | null> {
  const header = req.headers.get("authorization");

  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    const record = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.revokedAt) {
      return NextResponse.json({ error: "Invalid or revoked API token" }, { status: 401 });
    }
    prisma.apiToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
    return null;
  }

  if (process.env.API_REQUIRE_TOKEN === "1") {
    const site = req.headers.get("sec-fetch-site");
    if (site !== "same-origin" && site !== "none") {
      return NextResponse.json({ error: "API token required" }, { status: 401 });
    }
  }
  return null;
}

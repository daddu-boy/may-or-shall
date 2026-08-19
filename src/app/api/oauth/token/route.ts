import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SCOPE, issueTokens, sha256, verifyPkce } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function fail(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status, headers: CORS });
}

/** Token endpoint: authorization_code (with PKCE) and refresh_token grants. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const get = (k: string) => {
    const v = form?.get(k);
    return typeof v === "string" ? v : "";
  };
  if (!form) return fail("invalid_request", "Expected application/x-www-form-urlencoded");

  const grantType = get("grant_type");

  if (grantType === "refresh_token") {
    const presented = get("refresh_token");
    if (!presented) return fail("invalid_request", "refresh_token is required");
    const existing = await prisma.oAuthToken.findUnique({
      where: { refreshHash: sha256(presented) },
      select: { id: true, clientId: true, userId: true, resource: true, revokedAt: true },
    });
    if (!existing || existing.revokedAt) return fail("invalid_grant", "Refresh token is not valid");
    // rotate: the presented refresh token is retired as the new pair is issued
    await prisma.oAuthToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await issueTokens({
      clientId: existing.clientId,
      userId: existing.userId,
      resource: existing.resource,
    });
    return NextResponse.json(tokens, { headers: CORS });
  }

  if (grantType !== "authorization_code") {
    return fail("unsupported_grant_type", `Unsupported grant_type: ${grantType || "(none)"}`);
  }

  const code = get("code");
  const verifier = get("code_verifier");
  const redirectUri = get("redirect_uri");
  const clientId = get("client_id");
  if (!code || !verifier) return fail("invalid_request", "code and code_verifier are required");

  const record = await prisma.oAuthCode.findUnique({
    where: { codeHash: sha256(code) },
    select: {
      id: true,
      clientId: true,
      userId: true,
      redirectUri: true,
      codeChallenge: true,
      resource: true,
      expiresAt: true,
      usedAt: true,
    },
  });
  if (!record) return fail("invalid_grant", "Authorization code is not valid");

  // A replayed code means it may have been stolen: retire everything it produced.
  if (record.usedAt) {
    await prisma.oAuthToken.updateMany({
      where: { userId: record.userId, clientId: record.clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return fail("invalid_grant", "Authorization code has already been used");
  }
  if (record.expiresAt.getTime() < Date.now()) return fail("invalid_grant", "Authorization code has expired");
  if (clientId && clientId !== record.clientId) return fail("invalid_grant", "client_id does not match");
  if (redirectUri && redirectUri !== record.redirectUri)
    return fail("invalid_grant", "redirect_uri does not match");
  if (!verifyPkce(verifier, record.codeChallenge)) return fail("invalid_grant", "PKCE verification failed");

  await prisma.oAuthCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  const tokens = await issueTokens({
    clientId: record.clientId,
    userId: record.userId,
    resource: record.resource,
  });
  return NextResponse.json({ ...tokens, scope: SCOPE }, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

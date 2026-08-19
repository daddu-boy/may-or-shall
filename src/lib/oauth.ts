import { createHash, randomBytes } from "crypto";
import { prisma } from "./db";

/**
 * A small OAuth 2.1 authorization server, existing for one reason: an MCP
 * client should connect by the user clicking Allow, not by pasting a secret.
 * Directory-listed connectors (Claude, ChatGPT) require that, and a paste-a-
 * token flow is also worse for the user.
 *
 * Deliberately narrow. One scope, public clients only, PKCE required, tokens
 * bound to a single resource so a token minted here cannot be replayed at
 * another server (RFC 8707 audience binding).
 */

export const SCOPE = "mcp";
const CODE_TTL_MS = 10 * 60 * 1000; // authorization codes are short lived
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** The app's public origin, as clients will see it. */
export function origin(): string {
  const base = process.env.AUTH_URL || "https://app.mayorshall.com";
  return base.replace(/\/$/, "");
}

/** The canonical resource identifier this server issues tokens for. */
export function resourceUrl(): string {
  return `${origin()}/api/mcp`;
}

export function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

/** PKCE S256 verification. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  const hashed = createHash("sha256").update(verifier).digest("base64url");
  return hashed === challenge;
}

function secret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export async function issueCode(params: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
}): Promise<string> {
  const code = secret(32);
  await prisma.oAuthCode.create({
    data: {
      codeHash: sha256(code),
      clientId: params.clientId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      resource: params.resource,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

export type IssuedTokens = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

export async function issueTokens(params: {
  clientId: string;
  userId: string;
  resource: string;
}): Promise<IssuedTokens> {
  const access = secret(32);
  const refresh = secret(32);
  await prisma.oAuthToken.create({
    data: {
      tokenHash: sha256(access),
      refreshHash: sha256(refresh),
      clientId: params.clientId,
      userId: params.userId,
      resource: params.resource,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "Bearer",
    expires_in: Math.floor(TOKEN_TTL_MS / 1000),
    scope: SCOPE,
  };
}

/**
 * Resolve an OAuth access token to a user, refusing anything expired, revoked,
 * or minted for a different resource. Returns null rather than throwing so the
 * caller can fall through to other credential types.
 */
export async function userFromAccessToken(
  token: string,
  expectedResource: string
): Promise<string | null> {
  const rec = await prisma.oAuthToken.findUnique({
    where: { tokenHash: sha256(token) },
    select: { id: true, userId: true, resource: true, expiresAt: true, revokedAt: true },
  });
  if (!rec || rec.revokedAt) return null;
  if (rec.expiresAt.getTime() < Date.now()) return null;
  if (rec.resource !== expectedResource) return null; // audience binding
  prisma.oAuthToken
    .update({ where: { id: rec.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return rec.userId;
}

export function parseRedirectUris(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Redirect URIs must be https, or loopback for desktop and CLI clients which
 * listen on a random localhost port. Anything else is refused at registration.
 */
export function isAllowedRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"))
      return true;
    return false;
  } catch {
    return false;
  }
}

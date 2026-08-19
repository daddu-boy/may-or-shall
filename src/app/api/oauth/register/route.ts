import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { isAllowedRedirect } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * RFC 7591 dynamic client registration. MCP clients register themselves the
 * first time a user connects, so nobody has to be issued credentials by hand.
 * Registration is open, which is what the protocol expects: a client id alone
 * grants nothing until a user completes the consent flow.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "Body must be JSON" },
      { status: 400, headers: CORS }
    );
  }

  const uris = Array.isArray(body.redirect_uris) ? (body.redirect_uris as unknown[]) : [];
  const redirectUris = uris.filter((u): u is string => typeof u === "string");
  if (!redirectUris.length) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris is required" },
      { status: 400, headers: CORS }
    );
  }
  const bad = redirectUris.find((u) => !isAllowedRedirect(u));
  if (bad) {
    return NextResponse.json(
      {
        error: "invalid_redirect_uri",
        error_description: `Redirect URIs must be https, or http on localhost: ${bad}`,
      },
      { status: 400, headers: CORS }
    );
  }

  const clientId = `mos_client_${randomBytes(16).toString("hex")}`;
  const clientName =
    typeof body.client_name === "string" && body.client_name.trim()
      ? body.client_name.trim().slice(0, 120)
      : "An MCP client";

  await prisma.oAuthClient.create({
    data: { clientId, clientName, redirectUris: JSON.stringify(redirectUris) },
  });

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201, headers: CORS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

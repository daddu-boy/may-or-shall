import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { issueCode, parseRedirectUris, resourceUrl } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Receives the consent decision and hands the client back an authorization code. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };

  const clientId = get("client_id");
  const redirectUri = get("redirect_uri");
  const codeChallenge = get("code_challenge");
  const state = get("state");
  const resource = get("resource") || resourceUrl();
  const decision = get("decision");

  const client = clientId ? await prisma.oAuthClient.findUnique({ where: { clientId } }) : null;
  if (!client || !parseRedirectUris(client.redirectUris).includes(redirectUri)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const back = new URL(redirectUri);
  if (state) back.searchParams.set("state", state);

  if (decision !== "allow") {
    back.searchParams.set("error", "access_denied");
    return NextResponse.redirect(back, 303);
  }

  const session = await auth();
  if (!session?.user?.id) {
    back.searchParams.set("error", "access_denied");
    back.searchParams.set("error_description", "Not signed in");
    return NextResponse.redirect(back, 303);
  }

  const code = await issueCode({
    clientId,
    userId: session.user.id,
    redirectUri,
    codeChallenge,
    resource,
  });
  back.searchParams.set("code", code);
  return NextResponse.redirect(back, 303);
}

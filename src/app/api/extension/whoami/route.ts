import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * Who is signed into the web app in this browser.
 *
 * The clipper's handshake (extension/connect.js) needs to know this on every
 * visit, because someone who signs in as a different account must not go on
 * clipping into the first one. It cannot ask /api/extension/session for that:
 * that endpoint mints a token and revokes the previous one, so calling it on
 * every page load would log the clipper out of the user's other browsers.
 * This answers the question and changes nothing.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ signedIn: false }, { status: 200, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json(
    { signedIn: true, email: session.user.email ?? null },
    { headers: { "cache-control": "no-store" } }
  );
}

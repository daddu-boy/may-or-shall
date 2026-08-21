import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Domain verification for the ChatGPT plugin directory. OpenAI fetches this
 * path and expects the token back as the entire body, so it is served as plain
 * text with no wrapper, no newline and no framework decoration.
 *
 * It lives in the repo rather than as a file dropped on the server so that it
 * survives every deploy: verification is re-checked, and a token that vanishes
 * can get the app delisted. The value is not a secret, it is published here on
 * purpose.
 */
const TOKEN = "dlZPVg-BtbYKCxZm1ZncfoJRwfRWzUTz8RvQGc8Qs2U";

export async function GET() {
  return new NextResponse(TOKEN, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

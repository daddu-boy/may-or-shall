import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which build is serving this request.
 *
 * A tab opened before a deploy keeps asking the new server for code the new
 * server has never heard of, and the failures are silent: a button is pressed
 * and nothing happens. The client polls this and offers a reload when the
 * answer changes, so a deploy stops looking like a broken app.
 */
export function GET() {
  const build =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.RAILWAY_DEPLOYMENT_ID ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    "dev";
  return NextResponse.json({ build }, { headers: { "cache-control": "no-store" } });
}

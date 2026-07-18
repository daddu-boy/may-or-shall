import { NextRequest, NextResponse } from "next/server";

/**
 * CORS for the hosted Word task pane (docs/ on GitHub Pages).
 *
 * The pane is a static page served from a public origin; the user's matter
 * data stays on this server and is fetched cross-origin with their API token.
 * Only the origins below are allowed — no wildcard. The private-network
 * header answers Chromium's PNA preflight for public-page → localhost calls.
 */
const ALLOWED_ORIGINS = new Set(
  ["https://daddu-boy.github.io", process.env.ADDIN_EXTRA_ORIGIN].filter(Boolean) as string[]
);

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return NextResponse.next();

  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin",
  };

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: cors });
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/api/:path*" };

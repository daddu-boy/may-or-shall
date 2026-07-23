import { NextRequest, NextResponse } from "next/server";

/**
 * Two jobs:
 *  1. CORS for the cross-origin clients (Word task pane on GitHub Pages, and the
 *     Chrome extension when it calls the hosted API). Only listed origins; the
 *     private-network header answers Chromium's PNA preflight.
 *  2. A session-cookie gate on the app pages: an unauthenticated visitor to a
 *     page is redirected to /signin. This is UX only — real enforcement lives in
 *     the API route handlers, which resolve a user from a session or API token.
 */
const ALLOWED_ORIGINS = new Set(
  ["https://daddu-boy.github.io", process.env.ADDIN_EXTRA_ORIGIN].filter(Boolean) as string[]
);

// public paths that never require a session cookie
const PUBLIC_PREFIXES = ["/signin", "/addin", "/api", "/_next", "/favicon"];

function withCors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.headers.set("Access-Control-Allow-Private-Network", "true");
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CORS preflight for cross-origin API calls
  if (pathname.startsWith("/api")) {
    const origin = req.headers.get("origin");
    if (req.method === "OPTIONS" && origin && ALLOWED_ORIGINS.has(origin)) {
      return withCors(req, new NextResponse(null, { status: 204 }));
    }
    return withCors(req, NextResponse.next());
  }

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // app page: require a session cookie, else send to sign-in
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // everything except Next internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

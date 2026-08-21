import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A single demo account, for app-store reviewers who cannot receive our
 * passwordless sign-in emails and are not permitted to create accounts.
 *
 * Deliberately narrow. It is off unless DEMO_PASSWORD is set in the
 * environment, it authenticates exactly one address, and the password is
 * compared in constant time. No real account is reachable through it: any other
 * identifier is refused before a lookup happens. The account holds nothing but
 * the generated sample matter, which is fictional.
 *
 * It creates the Auth.js database session itself rather than going through a
 * credentials provider, because Auth.js only supports credentials with JWT
 * sessions and this app deliberately uses database sessions for email links.
 */
const DEMO_EMAIL = "reviewer@mayorshall.com";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const expected = process.env.DEMO_PASSWORD;
  const form = await req.formData().catch(() => null);
  const email = String(form?.get("email") || "").trim().toLowerCase();
  const password = String(form?.get("password") || "");

  const deny = () =>
    NextResponse.redirect(new URL("/demo-signin?error=1", req.url), 303);

  if (!expected || email !== DEMO_EMAIL || !password) return deny();
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return deny();

  // seeded through the same path a real new account takes, so the reviewer
  // sees exactly what a new user sees
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: DEMO_EMAIL, name: "May or Shall demo", emailVerified: new Date() },
    });
    const { createSampleMatter } = await import("@/lib/sampleMatter");
    await createSampleMatter(user.id);
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + THIRTY_DAYS);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });

  const secure = new URL(req.url).protocol === "https:";
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set({
    name: secure ? "__Secure-authjs.session-token" : "authjs.session-token",
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires,
  });
  return res;
}

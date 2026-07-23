import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/db";

/**
 * Passwordless email magic-link auth (Auth.js v5). Sessions are stored in the
 * database (required for email links). In production the link is emailed via
 * Resend; without a RESEND_API_KEY the link is logged to the server console so
 * the flow can be exercised locally.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/signin", verifyRequest: "/signin?sent=1" },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY || "dev-no-key",
      from: process.env.EMAIL_FROM || "May or Shall <onboarding@resend.dev>",
      async sendVerificationRequest({ identifier: email, url, provider }) {
        if (!process.env.RESEND_API_KEY) {
          // eslint-disable-next-line no-console
          console.log(`\n[dev] magic sign-in link for ${email}:\n${url}\n`);
          return;
        }
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to: email,
            subject: "Sign in to May or Shall",
            html: `
              <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px">
                <h2 style="margin:0 0 8px">Sign in to May or Shall</h2>
                <p style="color:#475569">Click the button to sign in. This link expires shortly and can be used once.</p>
                <p style="margin:20px 0">
                  <a href="${url}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">Sign in</a>
                </p>
                <p style="color:#94a3b8;font-size:12px">If you did not request this, you can ignore this email.</p>
              </div>`,
          }),
        });
        if (!res.ok) throw new Error(`Resend send failed: ${await res.text()}`);
      },
    }),
  ],
});

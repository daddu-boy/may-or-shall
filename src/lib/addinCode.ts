import { createHash, randomInt } from "crypto";

/**
 * Sign-in codes for the Word task pane.
 *
 * A magic *link* can't work there: the link opens in the user's default browser,
 * which is a different context from the pane inside Word, so the pane never
 * learns that sign-in happened. Instead we email a short code the user types
 * straight into the pane — the whole flow stays inside Word.
 *
 * Codes live in the Auth.js VerificationToken table under an "addin:" prefix,
 * so they can't be confused with (or used as) web sign-in links.
 */

/** No 0/O/1/I/L — these get misread when copied off a screen. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 8;
export const CODE_TTL_MS = 10 * 60 * 1000;

export function identifierFor(email: string): string {
  return `addin:${email.trim().toLowerCase()}`;
}

/** 8 chars from a 31-char alphabet ≈ 40 bits — far past guessing in 10 minutes. */
export function generateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function normaliseCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`${identifierFor(email)}:${code}`).digest("hex");
}

/** Formats as ABCD-EFGH for legibility in the email. */
export function prettyCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function sendCodeEmail(email: string, code: string): Promise<void> {
  const from = process.env.EMAIL_FROM || "May or Shall <onboarding@resend.dev>";
  if (!process.env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.log(`\n[dev] Word add-in sign-in code for ${email}: ${prettyCode(code)}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: `${prettyCode(code)} is your May or Shall code`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px">
          <h2 style="margin:0 0 8px">Your sign-in code</h2>
          <p style="color:#475569">Type this into the May or Shall pane in Word:</p>
          <p style="font-size:30px;font-weight:700;letter-spacing:4px;margin:18px 0">${prettyCode(code)}</p>
          <p style="color:#94a3b8;font-size:12px">The code expires in 10 minutes and can be used once.
            If you did not request it, you can ignore this email.</p>
        </div>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${await res.text()}`);
}

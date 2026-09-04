import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { origin } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Send the reminders that have come due, and stamp each one so a job that runs
 * twice in a day cannot send twice.
 *
 * Everything due up to now is picked up rather than only today's, so a day the
 * scheduler misses is caught on the next run instead of being lost silently.
 * A reminder is a convenience: it must never be the diary of record, and the
 * mail says so.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Reminders are not configured" }, { status: 503 });
  }
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (given !== secret) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const due = await prisma.card.findMany({
    where: { cardType: "MISC", remindSentAt: null, remindAt: { not: null, lte: new Date() } },
    select: {
      id: true,
      body: true,
      quote: true,
      remindAt: true,
      matterId: true,
      matter: { select: { title: true, user: { select: { email: true } } } },
    },
    take: 200,
  });
  if (due.length === 0) return NextResponse.json({ sent: 0, recipients: 0 });

  // one mail per person, however many notes they have due
  const byEmail = new Map<string, typeof due>();
  for (const c of due) {
    const to = c.matter.user.email;
    if (!to) continue;
    byEmail.set(to, [...(byEmail.get(to) ?? []), c]);
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    return NextResponse.json({ error: "Email is not configured" }, { status: 503 });
  }
  const base = origin();

  /** the app already talks to Resend over its REST API, so do the same here */
  const send = async (to: string, subject: string, html: string) => {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
  };

  let sent = 0;
  const delivered: string[] = [];
  for (const [to, cards] of byEmail) {
    const lines = cards
      .map((c) => {
        const text = (c.body || c.quote || "Untitled note").replace(/\s+/g, " ").trim();
        return `<li style="margin-bottom:10px">${escapeHtml(text.slice(0, 300))}<br>
          <a href="${base}/matters/${c.matterId}/cards?card=${c.id}"
             style="color:#4f46e5;font-size:13px">${escapeHtml(c.matter.title)}</a></li>`;
      })
      .join("");
    try {
      await send(
        to,
        cards.length === 1
          ? "A note you asked to be reminded about"
          : `${cards.length} notes you asked to be reminded about`,
        `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;color:#1d1d1f">
          <p style="font-size:15px">You set a reminder on ${cards.length === 1 ? "this note" : "these notes"} in May or Shall.</p>
          <ul style="padding-left:18px;font-size:14px;line-height:1.5">${lines}</ul>
          <p style="font-size:12px;color:#86868b;line-height:1.6">This is a convenience and not a diary of record.
          Do not rely on it for a limitation date or a filing deadline.
          Clear a reminder from the card's menu in the app.</p>
        </div>`
      );
      sent += cards.length;
      delivered.push(...cards.map((c) => c.id));
    } catch {
      // leave this person's cards unstamped so the next run tries again
    }
  }

  if (delivered.length > 0) {
    await prisma.card.updateMany({
      where: { id: { in: delivered } },
      data: { remindSentAt: new Date() },
    });
  }
  return NextResponse.json({ sent, recipients: byEmail.size });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

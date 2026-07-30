"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function SignIn() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Confirm from our own state rather than relying on Auth.js redirecting to
  // ?sent=1 — otherwise the page can sit on "Sending link…" saying nothing.
  const [justSent, setJustSent] = useState(false);
  const sent = justSent || params.get("sent") === "1";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setError("");
    try {
      const res = await signIn("resend", { email: address, redirect: false, callbackUrl: "/" });
      if (res?.error) setError("We couldn't send the link. Check the address and try again.");
      else setJustSent(true);
    } catch {
      setError("We couldn't send the link. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">May or Shall</h1>
        <p className="mt-1 text-sm text-slate-500">Read once, use everywhere.</p>

        {sent ? (
          <div className="mt-6">
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Link sent ✓</p>
              <p className="mt-1">
                We emailed a one-click sign-in link
                {email.trim() ? (
                  <>
                    {" "}
                    to <b>{email.trim()}</b>
                  </>
                ) : null}
                . Open it on this device to sign in — it expires shortly and can be used once.
              </p>
              <p className="mt-2 text-emerald-700">
                Nothing after a minute? Check your spam folder.
              </p>
            </div>
            <button
              onClick={() => {
                setJustSent(false);
                setError("");
              }}
              className="mt-3 w-full text-center text-xs text-slate-500 underline hover:text-slate-700"
            >
              Use a different email address
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <label className="block text-xs font-medium text-slate-600">Email address</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@firm.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <button
              disabled={busy}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? "Sending link…" : "Email me a sign-in link"}
            </button>
            {error && <p className="text-center text-xs text-rose-600">{error}</p>}
            <p className="text-center text-xs text-slate-400">
              No password. We email you a secure link to sign in.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

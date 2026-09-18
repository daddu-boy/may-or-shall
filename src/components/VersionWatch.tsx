"use client";

import { useEffect, useState } from "react";

/**
 * Tells the user when the page they are looking at is older than the server.
 *
 * When May or Shall is deployed, every tab already open keeps running the old
 * code. Next.js then rejects that tab's requests ("Failed to find Server
 * Action"), and because nothing in the interface says so, the app simply stops
 * responding to clicks: a link that will not open, a draft that will not
 * create. This watches the build the server reports, and when it changes, says
 * plainly that a reload is needed. It never reloads on its own, because the
 * user may be in the middle of writing something.
 */
export default function VersionWatch() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let mine = "";
    let stopped = false;

    const check = async () => {
      if (stopped || stale) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (!build) return;
        if (!mine) mine = build;
        else if (build !== mine) setStale(true);
      } catch {
        /* offline or asleep: not a reason to shout at anyone */
      }
    };

    check();
    const timer = setInterval(check, 5 * 60 * 1000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    // the failure this exists to explain, should it happen before a poll does
    const onRejection = (e: PromiseRejectionEvent) => {
      const text = String((e.reason as Error)?.message ?? e.reason ?? "");
      if (/Failed to find Server Action|deployment/i.test(text)) setStale(true);
    };
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [stale]);

  if (!stale) return null;
  return (
    <div
      role="status"
      className="night glass fixed z-[100] left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 text-[13px]"
      style={{ bottom: `calc(1rem + env(safe-area-inset-bottom, 0px))`, color: "var(--text)" }}
    >
      <span>May or Shall has been updated. Reload this page to keep working.</span>
      <button onClick={() => location.reload()} className="chip px-3 py-1 font-medium" style={{ color: "var(--text)" }}>
        Reload
      </button>
    </div>
  );
}

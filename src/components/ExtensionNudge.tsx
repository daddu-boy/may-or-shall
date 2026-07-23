"use client";

import { useEffect, useState } from "react";

const STORE_URL =
  "https://chromewebstore.google.com/detail/jcdaggdinfgihjbjgmpieohgehalpfac";
const KEY = "mos.extNudgeDismissed";

/**
 * Companion nudge: points the user to the Chrome web clipper. The extension
 * finds this app on its own; the two just need to both be installed. Shown
 * until dismissed.
 */
export default function ExtensionNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(localStorage.getItem(KEY) !== "1");
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    setShow(false);
  };

  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3">
      <span className="text-lg leading-none mt-0.5">🌐</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-slate-800">Clip from any website</p>
        <p className="text-slate-600 mt-0.5">
          Add the free Chrome extension to save highlights from judgments, orders and news
          straight into your matters. It connects to this app automatically.
        </p>
        <div className="mt-2 flex items-center gap-4">
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Get the Chrome extension
          </a>
          <button onClick={dismiss} className="text-xs text-slate-500 hover:text-slate-700">
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-slate-400 hover:text-slate-600 text-sm leading-none"
      >
        ✕
      </button>
    </div>
  );
}

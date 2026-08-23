"use client";

import { useEffect, useState } from "react";

const EXT_ID = "jcdaggdinfgihjbjgmpieohgehalpfac";
const STORE_URL = `https://chromewebstore.google.com/detail/${EXT_ID}`;
const KEY = "mos.extNudgeDismissed";

/** Chromium-only: nobody else can install the extension, so don't suggest it. */
function canInstall(): boolean {
  const ua = navigator.userAgent;
  return /Chrome|Chromium|Edg\//.test(ua) && !/OPR\//.test(ua);
}

/**
 * Is the clipper already installed? Two signals, because older builds can't
 * announce themselves:
 *  - v2.1.2+ stamps data-mos-extension on <html> from its content script
 *  - any published build exposes its icon as a web-accessible resource, which
 *    only loads when the extension is present
 */
async function extensionInstalled(): Promise<boolean> {
  for (const wait of [0, 300, 800]) {
    // the content script runs at document_idle, so it may land after we mount
    await new Promise((r) => setTimeout(r, wait));
    if (document.documentElement.hasAttribute("data-mos-extension")) return true;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `chrome-extension://${EXT_ID}/icons/icon-32.png`;
  });
}

/**
 * Companion nudge: points the user to the Chrome web clipper. Hidden once the
 * extension is installed, on browsers that can't install it, and once
 * dismissed.
 */
export default function ExtensionNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(KEY) === "1" || !canInstall()) return;
    let cancelled = false;
    extensionInstalled().then((installed) => {
      if (!cancelled && !installed) setShow(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    setShow(false);
  };

  return (
    <div className="glass mb-6 flex items-start gap-3.5 px-5 py-4">
      <span className="mt-0.5 text-lg leading-none">🌐</span>
      <div className="min-w-0 flex-1 text-[13.5px]">
        <p className="font-semibold">Clip from any website</p>
        <p className="mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Add the free Chrome extension to save highlights from judgments, orders and news
          straight into your matters. It connects to this app automatically.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener"
            className="btn-primary px-4 py-2 text-[12.5px]"
          >
            Get the Chrome extension
          </a>
          <button
            onClick={dismiss}
            className="text-[12.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-sm leading-none"
        style={{ color: "var(--text-tertiary)" }}
      >
        ✕
      </button>
    </div>
  );
}

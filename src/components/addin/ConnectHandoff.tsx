"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Office.js globals are untyped at runtime */

import { useEffect, useState } from "react";
import Script from "next/script";

declare const Office: any;

/**
 * Sign-in handoff for the Word task pane.
 *
 * The pane opens this page in an Office dialog — a real top-level window, so
 * the session cookie works here even when it doesn't inside the pane's iframe
 * (Word on the web). By the time this renders, the server has confirmed the
 * session and minted a token; we hand it to the pane and close. The user never
 * sees or copies a token.
 */
export default function ConnectHandoff({ token }: { token: string }) {
  const [sent, setSent] = useState(false);
  const [standalone, setStandalone] = useState(false);

  const handoff = () => {
    try {
      if (typeof Office !== "undefined" && Office.context?.ui?.messageParent) {
        Office.context.ui.messageParent(token);
        setSent(true);
        return;
      }
    } catch {
      /* fall through to the standalone note */
    }
    setStandalone(true);
  };

  // If Office.js never loads (page opened outside Word), say so rather than hang.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!sent) setStandalone((s) => s || typeof Office === "undefined");
    }, 4000);
    return () => clearTimeout(t);
  }, [sent]);

  return (
    <main
      style={{
        fontFamily: "-apple-system, system-ui, Segoe UI, sans-serif",
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        color: "#1c1917",
        background: "#f3f1ec",
      }}
    >
      <Script
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
        strategy="afterInteractive"
        onReady={() => Office.onReady(handoff)}
      />
      <div>
        {sent ? (
          <>
            <h1 style={{ fontSize: 18, margin: "0 0 6px" }}>You&rsquo;re connected.</h1>
            <p style={{ color: "#57534e", fontSize: 14, margin: 0 }}>
              You can close this window and go back to Word.
            </p>
          </>
        ) : standalone ? (
          <>
            <h1 style={{ fontSize: 18, margin: "0 0 6px" }}>Signed in.</h1>
            <p style={{ color: "#57534e", fontSize: 14, margin: 0 }}>
              Open this from the May or Shall pane in Word to finish connecting.
            </p>
          </>
        ) : (
          <p style={{ color: "#57534e", fontSize: 14, margin: 0 }}>Connecting&hellip;</p>
        )}
      </div>
    </main>
  );
}

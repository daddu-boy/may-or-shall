// May or Shall — Web Clipper: selection popover.
// Mirrors the in-app reader's highlight-to-card popover: select text anywhere,
// pick a card type, and the selection becomes a typed card with this page as
// its source. Rendered in a shadow root so page CSS can't interfere.

(() => {
  const CARD_TYPES = [
    ["FACT", "Fact", "#3b82f6"],
    ["DATE", "Date", "#f59e0b"],
    ["ISSUE", "Issue", "#8b5cf6"],
    ["OUR_ARGUMENT", "Our argument", "#10b981"],
    ["THEIR_ARGUMENT", "Their argument", "#ef4444"],
    ["EVIDENCE", "Evidence", "#06b6d4"],
    ["CASE_LAW", "Case law", "#d946ef"],
    ["ADMISSION", "Admission", "#84cc16"],
    ["QUESTION", "Question", "#f97316"],
    ["MISC", "Misc", "#6b7280"],
  ];

  let host = null;
  let apiOrigin = null;

  chrome.runtime.sendMessage({ type: "getConfig" }, (res) => {
    if (res?.ok) {
      try {
        apiOrigin = new URL(res.config.apiBase).origin;
      } catch {}
    }
  });

  function dismiss() {
    host?.remove();
    host = null;
  }

  function extractDate(text) {
    const m = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
    if (!m) return null;
    const [, d, mo, y] = m.map(Number);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function showPopover(rect, quote) {
    dismiss();
    host = document.createElement("div");
    host.style.cssText = `position:fixed;z-index:2147483647;left:${Math.min(
      rect.left,
      innerWidth - 340
    )}px;top:${Math.min(rect.bottom + 8, innerHeight - 220)}px;`;
    const root = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      .box{width:320px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;
        box-shadow:0 12px 32px rgba(15,23,42,.18);padding:10px;
        font:12px/1.4 -apple-system,system-ui,sans-serif;color:#0f172a}
      .head{display:flex;align-items:center;gap:6px;margin-bottom:6px}
      .logo{width:9px;height:9px;border-radius:2px;background:#4f46e5}
      .title{font-weight:600;font-size:11px}
      .quote{color:#94a3b8;font-size:11px;max-height:2.6em;overflow:hidden;margin-bottom:6px}
      input{width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:6px;
        padding:4px 7px;font-size:11px;margin-bottom:7px;outline:none}
      .chips{display:flex;flex-wrap:wrap;gap:5px}
      .chips button{border:none;border-radius:99px;color:#fff;font-size:10.5px;font-weight:600;
        padding:4px 9px;cursor:pointer;opacity:.95}
      .chips button:hover{opacity:1;transform:translateY(-1px)}
      .status{margin-top:7px;font-size:11px;color:#64748b}
      .status.ok{color:#059669}.status.err{color:#dc2626}
      .close{margin-left:auto;border:none;background:none;color:#94a3b8;cursor:pointer;font-size:12px}
    `;
    root.appendChild(style);

    const box = document.createElement("div");
    box.className = "box";
    box.innerHTML = `
      <div class="head"><span class="logo"></span><span class="title">May or Shall</span>
        <button class="close" title="Dismiss">✕</button></div>
      <div class="quote">&ldquo;${quote.slice(0, 160).replace(/</g, "&lt;")}&rdquo;</div>
      <input type="text" placeholder="Optional note…">
      <div class="chips"></div>
      <div class="status"></div>
    `;
    root.appendChild(box);

    const chips = box.querySelector(".chips");
    const note = box.querySelector("input");
    const status = box.querySelector(".status");
    box.querySelector(".close").addEventListener("click", dismiss);

    for (const [value, label, color] of CARD_TYPES) {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.background = color;
      b.addEventListener("click", () => {
        status.textContent = "Saving…";
        status.className = "status";
        chrome.runtime.sendMessage(
          {
            type: "createCard",
            payload: {
              cardType: value,
              quote,
              note: note.value.trim(),
              eventDate: value === "DATE" ? extractDate(quote) : null,
              sourceUrl: location.href.slice(0, 2000),
              sourceTitle: document.title.slice(0, 300),
            },
          },
          (res) => {
            if (res?.ok) {
              status.textContent = "✓ Card saved to your matter";
              status.className = "status ok";
              setTimeout(dismiss, 1200);
            } else {
              status.textContent = res?.error || "Failed — check extension options";
              status.className = "status err";
            }
          }
        );
      });
      chips.appendChild(b);
    }

    document.documentElement.appendChild(host);
  }

  document.addEventListener("mouseup", (e) => {
    if (host && e.composedPath().includes(host)) return;
    // don't double up on the May or Shall app's own reader popover
    if (apiOrigin && location.origin === apiOrigin) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const quote = sel ? sel.toString().replace(/\s+/g, " ").trim() : "";
      if (!quote || quote.length < 3) {
        if (host && !e.composedPath().includes(host)) dismiss();
        return;
      }
      const rects = sel.getRangeAt(0).getClientRects();
      const rect = rects[rects.length - 1] || sel.getRangeAt(0).getBoundingClientRect();
      showPopover(rect, quote);
    }, 10);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dismiss();
  });
})();

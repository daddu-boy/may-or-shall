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
      .logo{width:16px;height:16px;border-radius:3px}
      .title{font-weight:600;font-size:11px}
      .quote{color:#94a3b8;font-size:11px;max-height:2.6em;overflow:hidden;margin-bottom:6px}
      input,select{width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:6px;
        padding:4px 7px;font-size:11px;margin-bottom:7px;outline:none;background:#fff;color:#0f172a}
      .newrow{display:none;gap:5px;margin-bottom:7px}
      .newrow.show{display:flex}
      .newrow input{flex:1;margin-bottom:0}
      .newrow button{border:none;border-radius:6px;background:#4f46e5;color:#fff;
        font-size:10.5px;font-weight:600;padding:4px 10px;cursor:pointer}
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
      <div class="head"><img class="logo" src="${chrome.runtime.getURL("icons/icon-32.png")}" alt=""><span class="title">May or Shall</span>
        <button class="close" title="Dismiss">✕</button></div>
      <div class="quote">&ldquo;${quote.slice(0, 160).replace(/</g, "&lt;")}&rdquo;</div>
      <select class="matter"><option value="">Loading matters…</option></select>
      <div class="newrow"><input type="text" class="newname" placeholder="New matter title…">
        <button type="button" class="createbtn">Create</button></div>
      <input type="text" class="note" placeholder="Optional note…">
      <div class="chips"></div>
      <div class="status"></div>
    `;
    root.appendChild(box);

    const chips = box.querySelector(".chips");
    const note = box.querySelector(".note");
    const matterSel = box.querySelector(".matter");
    const newRow = box.querySelector(".newrow");
    const newName = box.querySelector(".newname");
    const status = box.querySelector(".status");
    box.querySelector(".close").addEventListener("click", dismiss);

    const NEW = "__new__";
    const fillMatters = (matters, selectedId) => {
      matterSel.innerHTML = "";
      for (const m of matters) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.title;
        if (m.id === selectedId) opt.selected = true;
        matterSel.appendChild(opt);
      }
      const plus = document.createElement("option");
      plus.value = NEW;
      plus.textContent = "＋ New matter…";
      matterSel.appendChild(plus);
      if (!selectedId && matters[0]) matterSel.value = matters[0].id;
    };

    chrome.runtime.sendMessage({ type: "getState" }, (res) => {
      if (!res?.ok || res.error) {
        matterSel.innerHTML = `<option value="">⚠ Not connected</option>`;
        status.textContent = res?.error || "Cannot reach the app — check the extension options.";
        status.className = "status err";
        const base = res?.config?.apiBase;
        if (base) {
          const open = document.createElement("a");
          open.textContent = "Open the app ↗";
          open.href = base;
          open.target = "_blank";
          open.rel = "noopener";
          open.style.cssText = "display:inline-block;margin-top:4px;color:#4f46e5;font-weight:600";
          status.appendChild(document.createElement("br"));
          status.appendChild(open);
        }
        return;
      }
      fillMatters(res.matters, res.config.matterId);
      if (res.matters.length === 0) {
        matterSel.value = NEW;
        newRow.classList.add("show");
        newName.focus();
      }
    });

    matterSel.addEventListener("change", () => {
      newRow.classList.toggle("show", matterSel.value === NEW);
      if (matterSel.value === NEW) newName.focus();
    });

    box.querySelector(".createbtn").addEventListener("click", () => {
      const title = newName.value.trim();
      if (!title) return;
      status.textContent = "Creating matter…";
      status.className = "status";
      chrome.runtime.sendMessage({ type: "createMatter", title }, (res) => {
        if (res?.ok) {
          chrome.runtime.sendMessage({ type: "getState" }, (st) => {
            if (st?.ok) fillMatters(st.matters, res.matter.id);
            newRow.classList.remove("show");
            status.textContent = `✓ Matter "${res.matter.title}" created`;
            status.className = "status ok";
          });
        } else {
          status.textContent = res?.error || "Could not create matter";
          status.className = "status err";
        }
      });
    });

    for (const [value, label, color] of CARD_TYPES) {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.background = color;
      b.addEventListener("click", () => {
        if (!matterSel.value || matterSel.value === "__new__") {
          status.textContent = "Pick or create a matter first.";
          status.className = "status err";
          return;
        }
        status.textContent = "Saving…";
        status.className = "status";
        chrome.runtime.sendMessage(
          {
            type: "createCard",
            payload: {
              matterId: matterSel.value,
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

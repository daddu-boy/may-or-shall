// May or Shall — Web Clipper: selection popover.
// Mirrors the in-app reader's highlight-to-card popover: select text anywhere,
// pick a card type, and the selection becomes a typed card with this page as
// its source. Rendered in a shadow root so page CSS can't interfere.
//
// Selecting text shows a small button, not the whole panel. The panel opens on
// hover, so reading a page with the clipper installed stays quiet.

(() => {
  // The background worker injects this file into tabs that were already open
  // when the extension was installed or updated.
  //
  // Copies from 2.1.x and earlier bound their listeners with no way to unbind,
  // so injecting alongside one would give the page two popovers. Leave that tab
  // to the old copy, which still works; the toolbar badge asks for the reload
  // that actually replaces it.
  if (window.__mosClipperLoaded && !window.__mosClipper) return;
  // From here on a newer copy can retire an older one in place, so an update
  // never needs a reload again.
  try {
    window.__mosClipper?.teardown();
  } catch {}
  window.__mosClipperLoaded = true;

  let dead = false; // this copy has been retired by a newer one

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

  // Events that belong to the popover and must not reach the host page. Sites
  // with their own editor (Claude, Gmail, Notion) listen on document for keys
  // and clicks and pull focus back into their composer, which would otherwise
  // swallow whatever is being typed into the note field here. Stopping them on
  // the shadow host means the popover's own inputs still receive the event,
  // and only the page's document-level listeners miss it.
  const SWALLOWED = [
    "keydown", "keyup", "keypress", "input", "beforeinput",
    "paste", "cut", "copy",
    "mousedown", "mouseup", "click", "dblclick",
    "pointerdown", "pointerup", "touchstart", "touchend",
    "focusin", "focusout",
  ];

  let host = null;
  let root = null;
  let apiOrigin = null;
  let enabled = true;
  let expanded = false;
  let anchor = null; // the selection rect the popover is placed against
  let quote = "";
  let hoverTimer = null;

  // Chrome tears the extension down when it updates or is reloaded, which
  // leaves this script running in a page it can no longer talk to. Every call
  // goes through here so that when it happens the page says so instead of
  // failing quietly.
  function alive() {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  function send(msg, cb) {
    if (dead) return;
    if (!alive()) {
      renderReload();
      return;
    }
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        if (dead) return;
        if (chrome.runtime.lastError) {
          renderReload();
          return;
        }
        cb?.(res);
      });
    } catch {
      renderReload();
    }
  }

  function iconUrl() {
    try {
      return chrome.runtime.getURL("icons/icon-32.png");
    } catch {
      return ""; // extension gone; the popover falls back to a plain mark
    }
  }

  send({ type: "getConfig" }, (res) => {
    if (res?.ok) {
      enabled = res.config.enabled !== false;
      try {
        apiOrigin = new URL(res.config.apiBase).origin;
      } catch {}
    }
  });

  // reflect the popup's on/off switch live, without needing a page reload
  function onStorageChanged(changes, area) {
    if (dead) return;
    if (area === "sync" && changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      if (!enabled) dismiss();
    }
  }
  try {
    chrome.storage.onChanged.addListener(onStorageChanged);
  } catch {}

  // storage is unreachable once the extension goes; these are cosmetic reads,
  // so failing quietly and skipping the hint is the right outcome
  function getSync(defaults, cb) {
    try {
      chrome.storage.sync.get(defaults, (v) => {
        if (!dead && !chrome.runtime.lastError) cb(v);
      });
    } catch {}
  }
  function setSync(patch) {
    try {
      chrome.storage.sync.set(patch);
    } catch {}
  }

  function dismiss() {
    clearTimeout(hoverTimer);
    host?.remove();
    host = null;
    root = null;
    expanded = false;
  }

  function extractDate(text) {
    const m = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
    if (!m) return null;
    const [, d, mo, y] = m.map(Number);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // Keep the popover on screen whatever it currently measures.
  function place(width, height) {
    if (!host || !anchor) return;
    const left = Math.max(8, Math.min(anchor.left, innerWidth - width - 8));
    const top = Math.max(8, Math.min(anchor.bottom + 8, innerHeight - height - 8));
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  }

  const STYLE = `
    .pill{display:flex;align-items:center;gap:6px;background:#fff;border:1px solid #e2e8f0;
      border-radius:99px;box-shadow:0 4px 14px rgba(15,23,42,.14);padding:5px 7px;cursor:pointer;
      font:12px/1 -apple-system,system-ui,sans-serif;color:#334155}
    .pill:hover{border-color:#c7d2fe;box-shadow:0 6px 18px rgba(79,70,229,.22)}
    .pill img{width:18px;height:18px;border-radius:4px;display:block}
    .pilltip{margin-left:7px;font-size:11px;color:#4f46e5;white-space:nowrap;align-self:center}
    .box{width:320px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;
      box-shadow:0 12px 32px rgba(15,23,42,.18);padding:10px;
      font:12px/1.4 -apple-system,system-ui,sans-serif;color:#0f172a}
    .head{display:flex;align-items:center;gap:6px;margin-bottom:6px}
    .logo{width:16px;height:16px;border-radius:3px}
    .title{font-weight:600;font-size:11px}
    .quote{color:#94a3b8;font-size:11px;max-height:2.6em;overflow:hidden;margin-bottom:6px}
    input,select{width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:6px;
      padding:4px 7px;font-size:11px;margin-bottom:7px;outline:none;background:#fff;color:#0f172a}
    input:focus,select:focus{border-color:#a5b4fc}
    .newrow{display:none;gap:5px;margin-bottom:7px}
    .newrow.show{display:flex}
    .newrow input{flex:1;margin-bottom:0}
    .newrow button{border:none;border-radius:6px;background:#4f46e5;color:#fff;
      font-size:10.5px;font-weight:600;padding:4px 10px;cursor:pointer}
    .chips{display:flex;flex-wrap:wrap;gap:5px}
    .chips button{border:none;border-radius:99px;color:#fff;font-size:10.5px;font-weight:600;
      padding:4px 9px;cursor:pointer;opacity:.95}
    .chips button:hover{opacity:1;transform:translateY(-1px)}
    .chips button.first{animation:mospulse 1.6s ease-out 2}
    @keyframes mospulse{0%{box-shadow:0 0 0 0 rgba(79,70,229,.45)}70%{box-shadow:0 0 0 7px rgba(79,70,229,0)}100%{box-shadow:0 0 0 0 rgba(79,70,229,0)}}
    .mark{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;
      border-radius:3px;background:#4f46e5;color:#fff;font-size:8.5px;font-weight:700}
    .notice{font-size:11.5px;line-height:1.45;color:#334155;margin-bottom:8px}
    .reloadbtn{border:none;border-radius:6px;background:#4f46e5;color:#fff;font-size:11px;
      font-weight:600;padding:6px 12px;cursor:pointer}
    .status{margin-top:7px;font-size:11px;color:#64748b}
    .status.ok{color:#059669}.status.err{color:#dc2626}
    .icon{margin-left:auto;border:none;background:none;color:#94a3b8;cursor:pointer;
      font-size:12px;padding:2px 3px;border-radius:4px;line-height:1}
    .icon + .icon{margin-left:0}
    .icon:hover{background:#f1f5f9;color:#334155}
    .icon.off:hover{background:#fef2f2;color:#dc2626}
  `;

  // ------------------------------------------------------------------ orphan

  // Chrome updated or reloaded the extension while this page was open. The
  // script left behind cannot reach the new copy, so say plainly what to do
  // rather than reporting a connection error the user cannot act on.
  function renderReload() {
    if (!host || dead) return;
    expanded = true;
    clearTimeout(hoverTimer);
    for (const n of [...root.children]) if (n.tagName !== "STYLE") n.remove();

    const box = document.createElement("div");
    box.className = "box";
    box.innerHTML = `
      <div class="head"><span class="mark">MS</span><span class="title">May or Shall</span>
        <button class="icon close" title="Dismiss">✕</button></div>
      <div class="notice">May or Shall was updated in the background. Reload this page to
        use the new version here. Your saved cards are unaffected.</div>
      <div class="chips"><button class="reloadbtn" type="button">Reload this page</button></div>
    `;
    root.appendChild(box);
    place(320, 150);
    box.querySelector(".close").addEventListener("click", dismiss);
    box.querySelector(".reloadbtn").addEventListener("click", () => location.reload());
  }

  // ---------------------------------------------------------------- collapsed

  function showPill(rect, text) {
    dismiss();
    anchor = rect;
    quote = text;

    host = document.createElement("div");
    host.style.cssText = "position:fixed;z-index:2147483647;left:-9999px;top:-9999px";
    root = host.attachShadow({ mode: "open" });
    for (const type of SWALLOWED) {
      host.addEventListener(type, (e) => {
        if (e.type === "keydown" && e.key === "Escape") dismiss();
        e.stopPropagation();
      });
    }

    const style = document.createElement("style");
    style.textContent = STYLE;
    root.appendChild(style);

    const src = iconUrl();
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center";
    wrap.innerHTML = `
      <button class="pill" type="button" title="Save this passage to a matter">
        ${src ? `<img src="${src}" alt="">` : `<span class="mark">MS</span>`}
      </button>
      <span class="pilltip" hidden>Hover to save this</span>
    `;
    root.appendChild(wrap);

    const pill = wrap.querySelector(".pill");
    // say what the button is for, once ever
    getSync({ hintSeen: false }, (v) => {
      if (v.hintSeen || !host) return;
      wrap.querySelector(".pilltip").hidden = false;
      setSync({ hintSeen: true });
    });

    // a short delay so merely sweeping the cursor past it does nothing
    pill.addEventListener("mouseenter", () => {
      hoverTimer = setTimeout(expand, 120);
    });
    pill.addEventListener("mouseleave", () => clearTimeout(hoverTimer));
    // hover is not available on touch, and not everyone reaches for it
    pill.addEventListener("click", expand);
    pill.addEventListener("focus", expand);

    document.documentElement.appendChild(host);
    place(150, 34);
  }

  // ----------------------------------------------------------------- expanded

  function expand() {
    if (!host || expanded || dead) return;
    // the extension went away while this page sat open
    if (!alive()) {
      renderReload();
      return;
    }
    expanded = true;
    clearTimeout(hoverTimer);

    root.querySelector("div")?.remove();

    const src = iconUrl();
    const box = document.createElement("div");
    box.className = "box";
    box.innerHTML = `
      <div class="head">${src ? `<img class="logo" src="${src}" alt="">` : `<span class="mark">MS</span>`}<span class="title">May or Shall</span>
        <button class="icon off" title="Turn clipping off on every page">⏻</button>
        <button class="icon close" title="Dismiss">✕</button></div>
      <div class="quote">&ldquo;${quote.slice(0, 160).replace(/</g, "&lt;")}&rdquo;</div>
      <select class="matter"><option value="">Loading matters…</option></select>
      <div class="newrow"><input type="text" class="newname" placeholder="New matter title…">
        <button type="button" class="createbtn">Create</button></div>
      <input type="text" class="note" placeholder="Optional note…">
      <div class="chips"></div>
      <div class="status"></div>
    `;
    root.appendChild(box);
    place(320, 240);

    const chips = box.querySelector(".chips");
    const note = box.querySelector(".note");
    const matterSel = box.querySelector(".matter");
    const newRow = box.querySelector(".newrow");
    const newName = box.querySelector(".newname");
    const status = box.querySelector(".status");
    box.querySelector(".close").addEventListener("click", dismiss);

    // Turning it off here is the quick way out of a popover you did not want.
    // The toolbar icon's switch is how it comes back, so say so before going.
    box.querySelector(".off").addEventListener("click", () => {
      status.textContent = "Clipping off. Turn it back on from the toolbar icon.";
      status.className = "status";
      setTimeout(() => setSync({ enabled: false }), 1500);
    });

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

    // only now, on opening: a selection the user never expands costs no request
    send({ type: "getState" }, (res) => {
      if (!host) return;
      const linkTo = (label, href) => {
        const a = document.createElement("a");
        a.textContent = label;
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener";
        a.style.cssText = "display:inline-block;margin-top:4px;color:#4f46e5;font-weight:600";
        status.appendChild(document.createElement("br"));
        status.appendChild(a);
      };
      const base = res?.config?.apiBase;
      if (res?.needsAuth) {
        // not signed in yet — signing into the app auto-connects the clipper
        matterSel.innerHTML = `<option value="">⚠ Not connected</option>`;
        status.textContent =
          "Open May or Shall and sign in — this clipper connects automatically.";
        status.className = "status";
        if (base) linkTo("Open May or Shall & sign in ↗", base);
        return;
      }
      if (!res?.ok || res.error) {
        matterSel.innerHTML = `<option value="">⚠ Not connected</option>`;
        status.textContent = res?.error || "Cannot reach the server — check the extension options.";
        status.className = "status err";
        if (base) linkTo("Open May or Shall ↗", base);
        return;
      }
      fillMatters(res.matters, res.config.matterId);
      if (res.matters.length === 0) {
        matterSel.value = NEW;
        newRow.classList.add("show");
        newName.focus();
        status.textContent = "No matters yet — name your first one and click Create.";
        status.className = "status";
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
      send({ type: "createMatter", title }, (res) => {
        if (!host) return;
        if (res?.ok) {
          send({ type: "getState" }, (st) => {
            if (!host) return;
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

    let firstChip = true;
    for (const [value, label, color] of CARD_TYPES) {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.background = color;
      if (firstChip) {
        firstChip = false;
        getSync({ chipsSeen: false }, (v) => {
          if (v.chipsSeen) return;
          b.classList.add("first");
          setSync({ chipsSeen: true });
        });
      }
      b.addEventListener("click", () => {
        if (!matterSel.value || matterSel.value === NEW) {
          status.textContent = "Pick or create a matter first.";
          status.className = "status err";
          return;
        }
        status.textContent = "Saving…";
        status.className = "status";
        send(
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
            if (!host) return;
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
  }

  function onMouseUp(e) {
    if (dead) return;
    if (host && e.composedPath().includes(host)) return;
    if (!enabled) return; // clipping switched off from the popup
    // don't double up on the May or Shall app's own reader popover
    if (apiOrigin && location.origin === apiOrigin) return;
    setTimeout(() => {
      if (dead) return;
      const sel = window.getSelection();
      const text = sel ? sel.toString().replace(/\s+/g, " ").trim() : "";
      if (!text || text.length < 3) {
        // clicks inside the popover never reach here, so this is a click away
        if (host) dismiss();
        return;
      }
      const rects = sel.getRangeAt(0).getClientRects();
      const rect = rects[rects.length - 1] || sel.getRangeAt(0).getBoundingClientRect();
      showPill(rect, text);
    }, 10);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") dismiss();
  }

  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("keydown", onKeyDown);

  // Let a newer copy of this script retire this one cleanly, so that updating
  // the extension swaps the code in an open tab instead of needing a reload.
  function teardown() {
    dead = true;
    dismiss();
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("keydown", onKeyDown);
    try {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    } catch {}
  }

  window.__mosClipper = { version: "2.2.0", teardown };
})();

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

  // Personal note leads, matching the app: it is the bucket a passage lands in
  // before you have decided what it is.
  const CARD_TYPES = [
    ["MISC", "Personal note", "#6b7280"],
    ["FACT", "Fact", "#3b82f6"],
    ["DATE", "Date", "#f59e0b"],
    ["ISSUE", "Issue", "#8b5cf6"],
    ["OUR_ARGUMENT", "Our argument", "#10b981"],
    ["THEIR_ARGUMENT", "Their argument", "#ef4444"],
    ["EVIDENCE", "Evidence", "#06b6d4"],
    ["CASE_LAW", "Case law", "#d946ef"],
    ["ADMISSION", "Admission", "#84cc16"],
    ["QUESTION", "Question", "#f97316"],
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

  // Drawn rather than typed: the power symbol (U+23FB) is not reliably present
  // in the Windows system fonts, and a missing glyph renders as a blank box.
  const ICON_OFF =
    '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round"><path d="M8 2.4v4.3"/>' +
    '<path d="M4.9 4.5a4.3 4.3 0 1 0 6.2 0"/></svg>';
  const ICON_CLOSE =
    '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round"><path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6"/></svg>';

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

  // Appearance follows the operating system the way a native panel does.
  // Options can force it either way for anyone who wants the panel to stay put
  // regardless of what the rest of their machine is doing.
  let theme = "auto";
  const darkMedia = window.matchMedia?.("(prefers-color-scheme: dark)");

  function isDark() {
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return !!darkMedia?.matches;
  }

  function applyTheme() {
    host?.classList.toggle("dark", isDark());
  }

  darkMedia?.addEventListener?.("change", applyTheme);

  send({ type: "getConfig" }, (res) => {
    if (res?.ok) {
      enabled = res.config.enabled !== false;
      theme = res.config.theme || "auto";
      applyTheme();
      try {
        apiOrigin = new URL(res.config.apiBase).origin;
      } catch {}
    }
  });

  // reflect the popup's on/off switch live, without needing a page reload
  function onStorageChanged(changes, area) {
    if (dead) return;
    if (area !== "sync") return;
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      if (!enabled) dismiss();
    }
    if (changes.theme) {
      theme = changes.theme.newValue || "auto";
      applyTheme();
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

  // Liquid glass: a translucent panel that picks up whatever is behind it,
  // hairline highlight on the light edge, capsule controls. The card type is
  // reduced to a dot so colour still ties a card to its highlight in the app
  // without ten saturated pills doing the shouting.
  //
  // The risk with real translucency is a white panel disappearing into a white
  // page, so every surface carries a faint dark hairline underneath the bright
  // one. Browsers without backdrop-filter get an opaque fallback further down.
  const STYLE = `
    :host{
      --font:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif;
      --surface:rgba(255,255,255,.55);
      --edge:rgba(255,255,255,.75);
      --hairline:rgba(0,0,0,.07);
      --shadow:0 12px 34px rgba(0,0,0,.18),0 1px 3px rgba(0,0,0,.06);
      --text:#1d1d1f; --muted:#5c5c60;
      --chip:rgba(255,255,255,.55); --chip-hover:rgba(255,255,255,.78);
      --chip-edge:rgba(255,255,255,.85);
      --field:rgba(255,255,255,.5); --field-edge:rgba(255,255,255,.8);
      --accent:#4f46e5; --on-accent:#fff;
      --ok:#0a7d55; --err:#b3261e;
      --under:rgba(0,0,0,.07); /* keeps white-on-white edges visible */
      --blur:blur(20px) saturate(180%);
    }
    :host(.dark){
      --surface:rgba(28,28,30,.6);
      --edge:rgba(255,255,255,.14);
      --hairline:rgba(0,0,0,.5);
      --shadow:0 14px 40px rgba(0,0,0,.55),0 1px 3px rgba(0,0,0,.4);
      --text:#f5f5f7; --muted:#a1a1a8;
      --chip:rgba(255,255,255,.1); --chip-hover:rgba(255,255,255,.17);
      --chip-edge:rgba(255,255,255,.14);
      --field:rgba(255,255,255,.08); --field-edge:rgba(255,255,255,.14);
      --accent:#8b87ff; --on-accent:#15151a;
      --ok:#3ddc97; --err:#ff6b6b;
      --under:rgba(0,0,0,.35);
    }

    .glass{
      background:var(--surface);
      -webkit-backdrop-filter:var(--blur);
      backdrop-filter:var(--blur);
      border:1px solid var(--edge);
      box-shadow:var(--shadow),0 0 0 1px var(--hairline);
      color:var(--text);
      font:12px/1.45 var(--font);
      letter-spacing:-.01em;
    }
    @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
      :host{--surface:rgba(255,255,255,.96)}
      :host(.dark){--surface:rgba(28,28,30,.97)}
    }

    .pill{display:flex;align-items:center;justify-content:center;border-radius:999px;
      padding:7px;cursor:pointer;transition:transform .16s ease}
    .pill:hover{transform:translateY(-1px)}
    .pill:active{transform:scale(.95)}
    .pill img{width:18px;height:18px;border-radius:5px;display:block}
    .pilltip{margin-left:9px;font:11px var(--font);color:var(--muted);white-space:nowrap;
      align-self:center;text-shadow:0 1px 2px rgba(255,255,255,.6)}
    :host(.dark) .pilltip{text-shadow:0 1px 2px rgba(0,0,0,.6)}

    .box{width:320px;border-radius:18px;padding:13px}
    .head{display:flex;align-items:center;gap:7px;margin-bottom:9px}
    .logo{width:16px;height:16px;border-radius:5px}
    .title{font-weight:600;font-size:11.5px}
    .quote{color:var(--muted);font-size:11px;line-height:1.45;max-height:2.9em;
      overflow:hidden;margin-bottom:10px}

    input,select{width:100%;box-sizing:border-box;border:1px solid var(--field-edge);
      border-radius:10px;padding:7px 10px;font:12px var(--font);margin-bottom:8px;outline:none;
      background:var(--field);color:var(--text);transition:border-color .14s ease;
      box-shadow:0 0 0 1px var(--under)}
    select{appearance:none;-webkit-appearance:none;padding-right:26px;
      background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),
        linear-gradient(135deg,currentColor 50%,transparent 50%);
      background-position:calc(100% - 14px) 13px,calc(100% - 10px) 13px;
      background-size:4px 4px,4px 4px;background-repeat:no-repeat}
    input::placeholder{color:var(--muted)}
    input:focus,select:focus{border-color:var(--accent)}

    .newrow{display:none;gap:6px;margin-bottom:8px}
    .newrow.show{display:flex}
    .newrow input{flex:1;margin-bottom:0}
    .newrow button{border:none;border-radius:999px;background:var(--accent);
      color:var(--on-accent);font:600 11px var(--font);padding:0 14px;cursor:pointer}

    .chips{display:flex;flex-wrap:wrap;gap:6px}
    .chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--chip-edge);
      background:var(--chip);color:var(--text);font:500 11.5px var(--font);
      letter-spacing:-.01em;padding:5px 11px;border-radius:999px;cursor:pointer;
      box-shadow:0 0 0 1px var(--under);
      transition:background .14s ease,transform .14s ease}
    .chip:hover{background:var(--chip-hover)}
    .chip:active{transform:scale(.97)}
    .dot{width:6px;height:6px;border-radius:50%;flex:none;
      box-shadow:0 0 0 2px rgba(255,255,255,.35)}
    :host(.dark) .dot{box-shadow:0 0 0 2px rgba(255,255,255,.08)}
    .saverow{display:flex;align-items:center;gap:8px}
    .savebtn{flex:1;border:0;border-radius:999px;background:var(--accent);color:var(--on-accent);
      font:600 12px var(--font);padding:8px 12px;cursor:pointer;transition:opacity .14s ease,transform .14s ease}
    .savebtn:hover{opacity:.92}
    .savebtn:active{transform:scale(.98)}
    /* Kept shut by default: nobody outside a courtroom should have to decide
       whether the sentence they just read is an Admission. Opened once, it
       stays open, so a litigator pays the click a single time. */
    .disclose{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--chip-edge);
      background:var(--chip);color:var(--muted);font:500 11px var(--font);
      padding:7px 10px;border-radius:999px;cursor:pointer;white-space:nowrap;
      box-shadow:0 0 0 1px var(--under);transition:background .14s ease,color .14s ease}
    .disclose:hover{background:var(--chip-hover);color:var(--text)}
    .chev{font-size:8px;line-height:1;transition:transform .18s ease}
    .disclose[aria-expanded="true"] .chev{transform:rotate(180deg)}
    .chips[hidden]{display:none}

    .mark{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;
      border-radius:5px;background:var(--accent);color:var(--on-accent);font:700 8px var(--font)}
    .notice{font-size:11.5px;line-height:1.5;color:var(--text);margin-bottom:11px}
    .reloadbtn{border:none;border-radius:999px;background:var(--accent);color:var(--on-accent);
      font:600 11.5px var(--font);padding:8px 15px;cursor:pointer}
    .status{margin-top:9px;font-size:11px;color:var(--muted)}
    .status.ok{color:var(--ok)}.status.err{color:var(--err)}
    .icon{margin-left:auto;border:none;background:none;color:var(--muted);cursor:pointer;
      font-size:12px;padding:3px 5px;border-radius:999px;line-height:1;
      transition:background .14s ease,color .14s ease}
    .icon svg{display:block}
    .icon + .icon{margin-left:0}
    .icon:hover{background:var(--chip-hover);color:var(--text)}
    .icon.off:hover{color:var(--err)}
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
    box.className = "box glass";
    box.innerHTML = `
      <div class="head"><span class="mark">MS</span><span class="title">May or Shall</span>
        <button class="icon close" title="Dismiss">${ICON_CLOSE}</button></div>
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
    applyTheme();
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
      <button class="pill glass" type="button" title="Save this passage to a matter">
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
    box.className = "box glass";
    box.innerHTML = `
      <div class="head">${src ? `<img class="logo" src="${src}" alt="">` : `<span class="mark">MS</span>`}<span class="title">May or Shall</span>
        <button class="icon off" title="Turn clipping off on every page">${ICON_OFF}</button>
        <button class="icon close" title="Dismiss">${ICON_CLOSE}</button></div>
      <div class="quote">&ldquo;${quote.slice(0, 160).replace(/</g, "&lt;")}&rdquo;</div>
      <select class="matter"><option value="">Loading matters…</option></select>
      <div class="newrow"><input type="text" class="newname" placeholder="New matter title…">
        <button type="button" class="createbtn">Create</button></div>
      <input type="text" class="note" placeholder="Optional note…">
      <div class="saverow">
        <button type="button" class="savebtn">Save note</button>
        <button type="button" class="disclose" aria-expanded="false">Legal tags <span class="chev">▾</span></button>
      </div>
      <div class="chips" hidden></div>
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

    /**
     * One save path. The plain button files the passage as a Personal note,
     * which is what a clipped passage honestly is before anyone has decided
     * what it is for. A legal tag files the same passage under a type.
     */
    function saveAs(value) {
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
    }

    box.querySelector(".savebtn").addEventListener("click", () => saveAs("MISC"));

    const disclose = box.querySelector(".disclose");
    const setTags = (open, remember) => {
      chips.hidden = !open;
      disclose.setAttribute("aria-expanded", String(open));
      place(320, open ? 300 : 240);
      if (remember) setSync({ legalTagsOpen: open });
    };
    disclose.addEventListener("click", () =>
      setTags(disclose.getAttribute("aria-expanded") !== "true", true)
    );
    // whoever opened it once works this way every time
    getSync({ legalTagsOpen: false }, (v) => {
      if (host && v.legalTagsOpen) setTags(true, false);
    });

    for (const [value, label, color] of CARD_TYPES) {
      if (value === "MISC") continue; // the plain save already files these
      const b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      // colour survives as a dot, so the chip still maps to the highlight
      // colour this card gets in the app without shouting
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = color;
      b.append(dot, document.createTextNode(label));
      b.addEventListener("click", () => saveAs(value));
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
    darkMedia?.removeEventListener?.("change", applyTheme);
    try {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    } catch {}
  }

  window.__mosClipper = { version: "2.3.0", teardown };
})();

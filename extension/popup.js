const matterSelect = document.getElementById("matter");
const newRow = document.getElementById("newrow");
const newName = document.getElementById("newname");
const note = document.getElementById("note");
const noteType = document.getElementById("notetype");
const tagToggle = document.getElementById("tagtoggle");
const typeRow = document.getElementById("typerow");

/*
 * The legal vocabulary is folded away here for the same reason it is in the
 * popover: most people clipping a page are not deciding whether a sentence is
 * an Admission. Opened once, it stays open, shared with the popover through
 * the same stored flag.
 */
function setTags(open, remember) {
  typeRow.hidden = !open;
  tagToggle.setAttribute("aria-expanded", String(open));
  tagToggle.textContent = open ? "Legal tags ▴" : "Legal tags ▾";
  if (!open) noteType.value = "MISC";
  if (remember) chrome.storage.sync.set({ legalTagsOpen: open });
}
tagToggle.addEventListener("click", () =>
  setTags(tagToggle.getAttribute("aria-expanded") !== "true", true)
);
chrome.storage.sync.get({ legalTagsOpen: false }, (v) => {
  if (v.legalTagsOpen) setTags(true, false);
});
const saveBtn = document.getElementById("save");
const status = document.getElementById("status");
const fixRow = document.getElementById("fixrow");
const welcomeBox = document.getElementById("welcome");
const enabledToggle = document.getElementById("enabled");
const recentWrap = document.getElementById("recentwrap");
const recentBox = document.getElementById("recent");
const appLinks = document.getElementById("applinks");
const NEW = "__new__";
let appUrl = "https://app.mayorshall.com";

const CARD_META = {
  MISC: ["Personal note", "#6b7280"],
  FACT: ["Fact", "#3b82f6"], DATE: ["Date", "#f59e0b"], ISSUE: ["Issue", "#8b5cf6"],
  OUR_ARGUMENT: ["Our argument", "#10b981"], THEIR_ARGUMENT: ["Their argument", "#ef4444"],
  EVIDENCE: ["Evidence", "#06b6d4"], CASE_LAW: ["Case law", "#d946ef"],
  ADMISSION: ["Admission", "#84cc16"], QUESTION: ["Question", "#f97316"],
};

// Show the last few cards saved to the selected matter, for instant confirmation.
function loadRecent(matterId) {
  if (!matterId || matterId === NEW) {
    recentWrap.style.display = "none";
    return;
  }
  chrome.runtime.sendMessage({ type: "listCards", matterId }, (res) => {
    if (!res?.ok) {
      recentWrap.style.display = "none";
      return;
    }
    recentWrap.style.display = "block";
    recentBox.innerHTML = "";
    if (!res.cards.length) {
      const d = document.createElement("div");
      d.className = "clip empty";
      d.textContent = "No clips yet in this matter — save one above or highlight text on a page.";
      recentBox.appendChild(d);
      return;
    }
    for (const c of res.cards) {
      const [label, color] = CARD_META[c.cardType] || ["Card", "#6b7280"];
      const el = document.createElement("div");
      el.className = "clip";
      const t = document.createElement("span");
      t.className = "t";
      const dot = document.createElement("i");
      dot.style.background = color;
      t.append(dot, document.createTextNode(label));
      const x = document.createElement("div");
      x.className = "x";
      x.textContent = c.text || "(no text)";
      el.append(t, x);
      if (c.source) {
        const s = document.createElement("div");
        s.className = "s";
        s.textContent = c.source;
        el.appendChild(s);
      }
      recentBox.appendChild(el);
    }
  });
}

function applyEnabled(on) {
  enabledToggle.checked = on;
  document.body.classList.toggle("off", !on);
}
enabledToggle.addEventListener("change", () => {
  const on = enabledToggle.checked;
  document.body.classList.toggle("off", !on);
  chrome.runtime.sendMessage({ type: "setConfig", config: { enabled: on } });
});

const setStatus = (text, cls = "") => {
  status.textContent = text;
  status.className = `status ${cls}`;
};

document.getElementById("options").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

function fillMatters(matters, selectedId) {
  matterSelect.innerHTML = "";
  for (const m of matters) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.title;
    if (m.id === selectedId) opt.selected = true;
    matterSelect.appendChild(opt);
  }
  const plus = document.createElement("option");
  plus.value = NEW;
  plus.textContent = "＋ New matter…";
  matterSelect.appendChild(plus);
  if (!selectedId && matters[0]) {
    matterSelect.value = matters[0].id;
    chrome.runtime.sendMessage({ type: "setConfig", config: { matterId: matters[0].id } });
  }
  if (matters.length === 0) {
    matterSelect.value = NEW;
    newRow.classList.add("show");
  }
}

function refresh() {
  setStatus("Connecting…");
  chrome.runtime.sendMessage({ type: "getState" }, (res) => {
    if (res?.config?.apiBase) appUrl = res.config.apiBase;
    if (res?.config) applyEnabled(res.config.enabled !== false);
    if (res?.needsAuth) {
      // not signed in / no token yet — guide the user to connect their account
      matterSelect.innerHTML = "<option>—</option>";
      setStatus("");
      welcomeBox.style.display = "block";
      fixRow.style.display = "none";
      recentWrap.style.display = "none";
      appLinks.style.display = "none";
      return;
    }
    appLinks.style.display = "flex";
    if (!res?.ok || res.error) {
      matterSelect.innerHTML = "<option>—</option>";
      welcomeBox.style.display = "none";
      setStatus(res?.error || "Cannot reach the server.", "err");
      fixRow.style.display = "flex";
      recentWrap.style.display = "none";
      return;
    }
    welcomeBox.style.display = "none";
    fixRow.style.display = "none";
    fillMatters(res.matters, res.config.matterId);
    if (res.matters.length === 0) {
      // connected, but no matters yet — invite the user to create their first
      newRow.classList.add("show");
      newName.focus();
      setStatus("Connected. Name your first matter below and click Create.", "ok");
      recentWrap.style.display = "none";
    } else {
      setStatus(`Connected · ${res.matters.length} active matter${res.matters.length === 1 ? "" : "s"}`);
      loadRecent(matterSelect.value);
    }
  });
}
refresh();

// After an update, tabs opened before it keep running the old content script
// until they are reloaded. The toolbar badge brings the user here; this offers
// the reload rather than performing it behind their back.
const updatedBox = document.getElementById("updated");
chrome.runtime.sendMessage({ type: "reloadState" }, (res) => {
  if (res?.needsReload) updatedBox.style.display = "block";
});
document.getElementById("doreload").addEventListener("click", () => {
  const btn = document.getElementById("doreload");
  btn.disabled = true;
  btn.textContent = "Reloading…";
  chrome.runtime.sendMessage({ type: "reloadTabs" }, (res) => {
    updatedBox.style.display = "none";
    setStatus(
      res?.ok ? `✓ Updated ${res.reloaded} page${res.reloaded === 1 ? "" : "s"}` : "Could not reload",
      res?.ok ? "ok" : "err"
    );
  });
});
document.getElementById("skipreload").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "dismissReload" }, () => {
    updatedBox.style.display = "none";
  });
});

document.getElementById("guide").addEventListener("click", () => {
  // opening the app signs the user in; connect.js then auto-connects the clipper
  chrome.tabs.create({ url: appUrl });
});
document.getElementById("openoptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById("openapp").addEventListener("click", () => {
  chrome.tabs.create({ url: appUrl });
});
document.getElementById("retry").addEventListener("click", refresh);

document.getElementById("viewall").addEventListener("click", (e) => {
  e.preventDefault();
  const id = matterSelect.value && matterSelect.value !== NEW ? matterSelect.value : "";
  chrome.tabs.create({ url: id ? `${appUrl}/matters/${id}/cards` : appUrl });
});

// Straight into the app's PDF reader for the selected matter; without one,
// the matter list — where the user can pick or create one first.
document.getElementById("uploadpdf").addEventListener("click", () => {
  const id = matterSelect.value && matterSelect.value !== NEW ? matterSelect.value : "";
  chrome.tabs.create({ url: id ? `${appUrl}/matters/${id}/documents` : appUrl });
});

document.getElementById("viewmatters").addEventListener("click", () => {
  chrome.tabs.create({ url: appUrl });
});

matterSelect.addEventListener("change", () => {
  const isNew = matterSelect.value === NEW;
  newRow.classList.toggle("show", isNew);
  if (isNew) {
    newName.focus();
    return;
  }
  chrome.runtime.sendMessage(
    { type: "setConfig", config: { matterId: matterSelect.value } },
    () => setStatus("Matter updated")
  );
  loadRecent(matterSelect.value);
});

document.getElementById("create").addEventListener("click", () => {
  const title = newName.value.trim();
  if (!title) return;
  setStatus("Creating matter…");
  chrome.runtime.sendMessage({ type: "createMatter", title }, (res) => {
    if (res?.ok) {
      newName.value = "";
      newRow.classList.remove("show");
      chrome.runtime.sendMessage({ type: "getState" }, (st) => {
        if (st?.ok) fillMatters(st.matters, res.matter.id);
        setStatus(`✓ Matter "${res.matter.title}" created and selected`, "ok");
        loadRecent(res.matter.id);
      });
    } else {
      setStatus(res?.error || "Could not create matter", "err");
    }
  });
});

saveBtn.addEventListener("click", () => {
  const text = note.value.trim();
  if (!text) {
    setStatus("Write something first.", "err");
    return;
  }
  if (!matterSelect.value || matterSelect.value === NEW) {
    setStatus("Pick or create a matter first.", "err");
    return;
  }
  setStatus("Saving…");
  saveBtn.disabled = true;
  // attach the current tab as the note's source when we can see it
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs?.[0];
    const isWeb = tab?.url && /^https?:/.test(tab.url);
    chrome.runtime.sendMessage(
      {
        type: "createCard",
        payload: {
          matterId: matterSelect.value,
          cardType: noteType.value,
          quote: "",
          note: text,
          sourceUrl: isWeb ? tab.url.slice(0, 2000) : null,
          sourceTitle: isWeb ? (tab.title || "").slice(0, 300) : null,
        },
      },
      (res) => {
        saveBtn.disabled = false;
        if (res?.ok) {
          note.value = "";
          setStatus("✓ Note saved as a card", "ok");
          loadRecent(matterSelect.value);
        } else {
          setStatus(res?.error || "Failed to save", "err");
        }
      }
    );
  });
});

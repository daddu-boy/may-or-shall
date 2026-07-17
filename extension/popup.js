const matterSelect = document.getElementById("matter");
const newRow = document.getElementById("newrow");
const newName = document.getElementById("newname");
const note = document.getElementById("note");
const noteType = document.getElementById("notetype");
const saveBtn = document.getElementById("save");
const status = document.getElementById("status");
const fixRow = document.getElementById("fixrow");
const enabledToggle = document.getElementById("enabled");
const NEW = "__new__";
let appUrl = "https://localhost:3000";

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
    if (!res?.ok || res.error) {
      matterSelect.innerHTML = "<option>—</option>";
      setStatus(res?.error || "Cannot reach the app — check Options.", "err");
      fixRow.style.display = "flex";
      return;
    }
    fixRow.style.display = "none";
    fillMatters(res.matters, res.config.matterId);
    setStatus(`Connected · ${res.matters.length} active matter${res.matters.length === 1 ? "" : "s"}`);
  });
}
refresh();

document.getElementById("openapp").addEventListener("click", () => {
  chrome.tabs.create({ url: appUrl });
});
document.getElementById("retry").addEventListener("click", refresh);

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
        } else {
          setStatus(res?.error || "Failed to save", "err");
        }
      }
    );
  });
});

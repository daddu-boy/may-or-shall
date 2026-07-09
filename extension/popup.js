const matterSelect = document.getElementById("matter");
const status = document.getElementById("status");

document.getElementById("options").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

chrome.runtime.sendMessage({ type: "listMatters" }, (res) => {
  if (!res?.ok) {
    matterSelect.innerHTML = "<option>—</option>";
    status.textContent = res?.error || "Cannot reach the app — check Options.";
    status.className = "status err";
    return;
  }
  chrome.runtime.sendMessage({ type: "getConfig" }, (cfg) => {
    matterSelect.innerHTML = "";
    for (const m of res.matters) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.title;
      if (cfg?.ok && cfg.config.matterId === m.id) opt.selected = true;
      matterSelect.appendChild(opt);
    }
    if (cfg?.ok && !cfg.config.matterId && res.matters[0]) {
      chrome.runtime.sendMessage({
        type: "setConfig",
        config: { matterId: res.matters[0].id },
      });
    }
    status.textContent = `Connected · ${res.matters.length} active matter${res.matters.length === 1 ? "" : "s"}`;
  });
});

matterSelect.addEventListener("change", () => {
  chrome.runtime.sendMessage(
    { type: "setConfig", config: { matterId: matterSelect.value } },
    () => {
      status.textContent = "Matter updated";
      status.className = "status";
    }
  );
});

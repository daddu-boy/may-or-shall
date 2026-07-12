const apiBase = document.getElementById("apiBase");
const token = document.getElementById("token");
const matter = document.getElementById("matter");
const status = document.getElementById("status");

function loadMatters(selectedId) {
  chrome.runtime.sendMessage({ type: "listMatters" }, (res) => {
    if (!res?.ok) {
      status.textContent = res?.error || "Connection failed";
      status.className = "err";
      return;
    }
    matter.innerHTML = "";
    for (const m of res.matters) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.title;
      if (m.id === selectedId) opt.selected = true;
      matter.appendChild(opt);
    }
    status.textContent = `Connected — ${res.matters.length} active matter${res.matters.length === 1 ? "" : "s"}`;
    status.className = "";
  });
}

chrome.runtime.sendMessage({ type: "getConfig" }, (res) => {
  if (!res?.ok) return;
  apiBase.value = res.config.apiBase || "https://localhost:3000";
  token.value = res.config.token || "";
  if (res.config.apiBase) loadMatters(res.config.matterId);
});

document.getElementById("save").addEventListener("click", () => {
  const config = {
    apiBase: apiBase.value.trim().replace(/\/$/, "") || "http://localhost:3000",
    token: token.value.trim(),
  };
  if (matter.value) config.matterId = matter.value;
  chrome.runtime.sendMessage({ type: "setConfig", config }, () => {
    status.textContent = "Saved — testing…";
    status.className = "";
    loadMatters(matter.value);
  });
});

matter.addEventListener("change", () => {
  chrome.runtime.sendMessage({ type: "setConfig", config: { matterId: matter.value } });
});

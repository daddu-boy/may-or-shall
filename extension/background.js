// May or Shall — Web Clipper: background service worker.
// All API calls happen here (host_permissions exempt them from CORS).

const DEFAULTS = { apiBase: "https://localhost:3000", token: "", matterId: "" };

async function getConfig() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

function headers(config) {
  const h = { "Content-Type": "application/json" };
  if (config.token) h["Authorization"] = `Bearer ${config.token}`;
  return h;
}

async function apiFetch(config, path, init = {}) {
  const res = await fetch(`${config.apiBase.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { ...headers(config), ...(init.headers || {}) },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

async function listMatters() {
  const config = await getConfig();
  if (!config.apiBase) throw new Error("Set the app URL in the extension options.");
  const matters = await apiFetch(config, "/api/matters");
  return matters
    .filter((m) => m.status === "ACTIVE")
    .map((m) => ({ id: m.id, title: m.title }));
}

async function createMatter(title) {
  const config = await getConfig();
  const matter = await apiFetch(config, "/api/matters", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  await chrome.storage.sync.set({ matterId: matter.id });
  return { id: matter.id, title: matter.title };
}

// config + matters in one round trip for the popover
async function getState() {
  const config = await getConfig();
  let matters = [];
  let error = null;
  try {
    matters = await listMatters();
  } catch (e) {
    error = e.message;
  }
  return { config, matters, error };
}

async function createCard(payload) {
  const config = await getConfig();
  const matterId = payload.matterId || config.matterId;
  if (!matterId)
    throw new Error("No matter selected — pick one from the extension icon.");
  if (payload.matterId && payload.matterId !== config.matterId) {
    await chrome.storage.sync.set({ matterId: payload.matterId });
  }
  return apiFetch(config, `/api/matters/${matterId}/cards`, {
    method: "POST",
    body: JSON.stringify({
      cardType: payload.cardType,
      quote: payload.quote,
      body: payload.note || payload.quote,
      eventDate: payload.eventDate || null,
      sourceUrl: payload.sourceUrl,
      sourceTitle: payload.sourceTitle,
    }),
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "createCard") {
        const card = await createCard(msg.payload);
        sendResponse({ ok: true, card });
      } else if (msg.type === "listMatters") {
        sendResponse({ ok: true, matters: await listMatters() });
      } else if (msg.type === "getState") {
        sendResponse({ ok: true, ...(await getState()) });
      } else if (msg.type === "createMatter") {
        sendResponse({ ok: true, matter: await createMatter(msg.title) });
      } else if (msg.type === "getConfig") {
        sendResponse({ ok: true, config: await getConfig() });
      } else if (msg.type === "setConfig") {
        await chrome.storage.sync.set(msg.config);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: `Unknown message: ${msg.type}` });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // async response
});

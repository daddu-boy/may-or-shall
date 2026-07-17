// May or Shall — Web Clipper: background service worker.
// All API calls happen here (host_permissions exempt them from CORS).

const DEFAULTS = { apiBase: "https://localhost:3000", token: "", matterId: "" };

async function getConfig() {
  const stored = await chrome.storage.sync.get({ ...DEFAULTS, explicitApiBase: false });
  // migrate the pre-1.1 default (app moved to HTTPS) — but never override a
  // URL the user explicitly saved in the options page
  if (stored.apiBase === "http://localhost:3000" && !stored.explicitApiBase) {
    stored.apiBase = "https://localhost:3000";
    await chrome.storage.sync.set({ apiBase: stored.apiBase, explicitApiBase: true });
  }
  return { ...DEFAULTS, ...stored };
}

function headers(config) {
  const h = { "Content-Type": "application/json" };
  if (config.token) h["Authorization"] = `Bearer ${config.token}`;
  return h;
}

async function apiFetch(config, path, init = {}) {
  const base = config.apiBase.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { ...headers(config), ...(init.headers || {}) },
    });
  } catch (e) {
    if (e.name === "AbortError")
      throw new Error(`Timed out reaching ${base} — is the May or Shall app running?`);
    const localHttps = /^https:\/\/(localhost|127\.0\.0\.1)/.test(base);
    throw new Error(
      `Can't reach ${base} — the app isn't running` +
        (localHttps
          ? " there, or your browser doesn't trust the local certificate yet. Open the app in a tab to check."
          : " at that address. Check it in Options.")
    );
  } finally {
    clearTimeout(timer);
  }
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
        const config = { ...msg.config };
        if (config.apiBase) config.explicitApiBase = true;
        await chrome.storage.sync.set(config);
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

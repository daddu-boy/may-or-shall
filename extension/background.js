// May or Shall — Web Clipper: background service worker.
// All API calls happen here (host_permissions exempt them from CORS).

// The clipper talks to the hosted May or Shall by default; self-hosters can
// point it at their own server in Options. It authenticates with an API token
// the user creates under Settings on the web app.
const HOSTED_URL = "https://app.mayorshall.com";
const DEFAULTS = { apiBase: HOSTED_URL, token: "", matterId: "", enabled: true };

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
    if (e.name === "AbortError") throw new Error(`Timed out reaching ${base}.`);
    throw new Error(`Can't reach ${base}. Check your internet connection.`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json()).error || message;
    } catch {}
    const err = new Error(message);
    if (res.status === 401) {
      err.needsAuth = true; // signed out / token revoked
      // Drop the dead token so the next visit to the app re-connects cleanly.
      await chrome.storage.sync.set({ token: "" });
    }
    throw err;
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

// Recent cards for a matter, newest first — powers the popup's "Recent clips".
async function listCards(matterId) {
  const config = await getConfig();
  const id = matterId || config.matterId;
  if (!id) return [];
  const cards = await apiFetch(config, `/api/matters/${id}/cards`);
  return cards
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)
    .map((c) => ({
      id: c.id,
      cardType: c.cardType,
      text: (c.body || c.quote || "").replace(/\s+/g, " ").trim().slice(0, 140),
      source: c.sourceTitle || c.sourceUrl || "",
    }));
}

// config + matters in one round trip for the popover
async function getState() {
  const config = await getConfig();
  // no token yet = the user hasn't connected their account (paste one from the
  // web app's Settings). Show the connect guidance rather than an error.
  if (!config.token) {
    return { config, matters: [], error: null, needsAuth: true };
  }
  let matters = [];
  let error = null;
  let needsAuth = false;
  try {
    matters = await listMatters();
  } catch (e) {
    error = e.message;
    if (e.needsAuth) needsAuth = true;
  }
  return { config, matters, error, needsAuth };
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

// Store the token handed over by the auto-connect handshake (connect.js) once
// the user is signed into the web app, so being logged in IS the connection.
async function connect({ apiBase, token, matters }) {
  const patch = { token };
  if (apiBase) patch.apiBase = apiBase.replace(/\/$/, "");
  // pre-select a matter so the very first clip has somewhere to go
  const current = await chrome.storage.sync.get({ matterId: "" });
  if (!current.matterId && Array.isArray(matters) && matters[0]) {
    patch.matterId = matters[0].id;
  }
  await chrome.storage.sync.set(patch);
  return { ok: true };
}

// First install: open the welcome page, which walks the user to the hosted app
// to sign in (that single step auto-connects the clipper).
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "createCard") {
        const card = await createCard(msg.payload);
        sendResponse({ ok: true, card });
      } else if (msg.type === "listMatters") {
        sendResponse({ ok: true, matters: await listMatters() });
      } else if (msg.type === "listCards") {
        sendResponse({ ok: true, cards: await listCards(msg.matterId) });
      } else if (msg.type === "getState") {
        sendResponse({ ok: true, ...(await getState()) });
      } else if (msg.type === "createMatter") {
        sendResponse({ ok: true, matter: await createMatter(msg.title) });
      } else if (msg.type === "connect") {
        sendResponse(await connect(msg));
      } else if (msg.type === "connectStatus") {
        const cfg = await getConfig();
        sendResponse({ ok: true, connected: !!cfg.token });
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

// May or Shall — Web Clipper: auto-connect handshake.
// This runs ONLY on May or Shall's own pages. When the user is signed in, it
// silently asks the app for an API token (using their logged-in session, sent
// as a same-origin cookie) and hands it to the background worker. Result:
// being signed into the web app IS the connection — no tokens to copy, no URL
// to enter. If the extension already has a token, it does nothing.
(() => {
  const apiBase = location.origin;

  // Tell the page we're installed, so it doesn't nag the user to install us.
  try {
    document.documentElement.setAttribute(
      "data-mos-extension",
      chrome.runtime.getManifest().version
    );
  } catch {
    /* non-fatal */
  }

  chrome.runtime.sendMessage({ type: "connectStatus" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res?.connected) return; // already connected — nothing to do

    fetch("/api/extension/session", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.token) return; // not signed in yet — user still needs to log in
        chrome.runtime.sendMessage({
          type: "connect",
          apiBase,
          token: data.token,
          matters: data.matters || [],
        });
      })
      .catch(() => {});
  });
})();

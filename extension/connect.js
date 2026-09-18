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

  const mint = (reason) =>
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
          email: data.email || "",
          matters: data.matters || [],
          switchedFrom: reason === "switch" ? true : undefined,
        });
      })
      .catch(() => {});

  chrome.runtime.sendMessage({ type: "connectStatus" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (!res?.connected) {
      mint("first");
      return;
    }
    /*
     * Already connected, but to whom? Signing into a second account used to
     * leave the clipper holding the first account's token: the popup named one
     * email while every clip went to the other, and a matter picked in one
     * account came back "not found" in the other. So ask who is signed in here
     * (a call that mints nothing) and re-connect if it is someone else.
     */
    fetch("/api/extension/whoami", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((who) => {
        if (!who?.signedIn || !who.email) return;
        const known = (res.email || "").toLowerCase();
        if (known && known === who.email.toLowerCase()) return;
        mint("switch");
      })
      .catch(() => {});
  });
})();

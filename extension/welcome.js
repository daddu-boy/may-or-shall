// Populate the download buttons for the visitor's OS. GitHub's
// /releases/latest/download/<asset> always resolves to the newest release, and
// the asset names below are kept stable across releases.
(() => {
  const BASE = "https://github.com/daddu-boy/may-or-shall/releases/latest/download";
  const ASSETS = {
    macArm: `${BASE}/May-or-Shall-macOS-Apple-Silicon.dmg`,
    macIntel: `${BASE}/May-or-Shall-macOS-Intel.dmg`,
    win: `${BASE}/May-or-Shall-Windows-Setup.exe`,
  };

  const ua = navigator.userAgent;
  const isWindows = /Windows/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua);

  const el = document.getElementById("downloads");
  const hint = document.getElementById("oshint");
  const btn = (href, label, cls = "") =>
    `<a class="btn ${cls}" href="${href}" download>⬇ ${label}</a>`;

  if (isWindows) {
    el.innerHTML = btn(ASSETS.win, "Download for Windows");
    hint.textContent = "Windows 10 or 11 · about 96 MB";
  } else if (isMac) {
    // Apple Silicon is the common case since 2020; offer Intel as the alternate
    el.innerHTML =
      btn(ASSETS.macArm, "Download for Mac (Apple Silicon)") +
      btn(ASSETS.macIntel, "Download for Mac (Intel)", "secondary");
    hint.textContent =
      "Most Macs from 2020 on are Apple Silicon (M1/M2/M3…). On an older Intel Mac, use the second button.";
  } else {
    // unknown OS — show everything and let them choose
    el.innerHTML =
      btn(ASSETS.macArm, "Mac (Apple Silicon)") +
      btn(ASSETS.macIntel, "Mac (Intel)", "secondary") +
      btn(ASSETS.win, "Windows", "secondary");
    hint.textContent = "Pick the build for your computer. Linux builds are planned.";
  }
})();

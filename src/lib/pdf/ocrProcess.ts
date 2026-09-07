import { spawn } from "node:child_process";

/** Bound the complete OCR process group, including Tesseract child processes. */
export function executeOcr(executable: string, args: string[], timeoutMs = 180_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const grouped = process.platform !== "win32";
    const child = spawn(executable, args, { detached: grouped, stdio: "ignore", windowsHide: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (grouped && child.pid) {
        try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
      } else child.kill("SIGKILL");
    }, timeoutMs);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", code => {
      clearTimeout(timer);
      if (timedOut) reject(new Error("OCR time limit exceeded"));
      else if (code !== 0) reject(new Error("OCR could not process this PDF"));
      else resolve();
    });
  });
}

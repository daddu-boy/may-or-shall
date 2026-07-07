// Keeps public/pdf.worker.min.mjs in sync with the installed pdfjs-dist version.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
mkdirSync(path.join(root, "public"), { recursive: true });
copyFileSync(
  path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
  path.join(root, "public/pdf.worker.min.mjs")
);
console.log("Copied pdf.worker.min.mjs to public/");

// Trim .next/standalone to the runtime essentials before packaging.
// `next build` (output: standalone) over-copies the whole repo — including
// .git and the ~300 MB .next/cache — which would otherwise ship inside the
// desktop app. Cross-platform (runs on the macOS and Windows CI runners alike).
import { rmSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error("no .next/standalone — run `next build` first");
  process.exit(1);
}

const drop = [
  ".next/cache", // ~300 MB webpack build cache
  // Next over-copies public/ into standalone; desktop packaging copies ../public
  // in as extraResources, so drop this duplicate or electron-builder hits EEXIST
  // hardlinking public/pdf.worker.min.mjs.
  "public",
  ".git", ".claude", "src", "tests", "test-results", "scripts",
  "store", "docs", "extension", "office-addin", "desktop", "prompts",
  "storage", "prisma",
  ".env", ".env.example", ".env.local", ".DS_Store",
  "Dockerfile", "docker-compose.yml", "playwright.config.ts",
  "tsconfig.json", "tsconfig.tsbuildinfo", "next-env.d.ts",
  "postcss.config.mjs", "tailwind.config.ts", ".eslintrc.json",
  ".gitignore", "package-lock.json", "README.md",
];

for (const rel of drop) {
  const p = join(standalone, rel);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

const kb = (p) => {
  try {
    return statSync(p).isDirectory() ? "" : "";
  } catch {
    return "";
  }
};
console.log("pruned .next/standalone to runtime essentials", kb(standalone));

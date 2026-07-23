#!/usr/bin/env bash
# Build the May or Shall desktop app (macOS).
# Produces a clean, minimal bundle: only the Next standalone runtime, not the
# whole repo. Run from the repo root or the desktop/ folder.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Free port 3000 (a dev server would clobber .next/standalone)"
lsof -tiTCP:3000 -sTCP:LISTEN | xargs kill 2>/dev/null || true
sleep 1

echo "==> Clean previous artifacts (stray copies break the type-check)"
rm -rf "$ROOT/desktop/dist" "$ROOT/.next/standalone"

echo "==> Next production build (output: standalone)"
npm run build >/dev/null

echo "==> Prune standalone to the runtime essentials"
node "$ROOT/desktop/prune-standalone.mjs"
du -sh "$ROOT/.next/standalone"

echo "==> Package with electron-builder"
cd "$ROOT/desktop"
npx electron-builder --mac "$@"

echo "==> Done. Artifacts in desktop/dist/"
ls -lh dist/*.dmg dist/*-mac.zip 2>/dev/null | awk '{print $5, $9}'

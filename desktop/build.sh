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

STANDALONE="$ROOT/.next/standalone"
echo "==> Prune standalone to the runtime essentials"
# the 297 MB build cache and the traced copy of the whole repo are not needed
rm -rf "$STANDALONE/.next/cache"
rm -rf "$STANDALONE"/{.git,.claude,src,tests,test-results,scripts,store,docs,extension,office-addin,desktop,prompts,storage,prisma}
rm -f  "$STANDALONE"/{.env,.env.example,.env.local,.DS_Store,Dockerfile,docker-compose.yml,\
playwright.config.ts,tsconfig.json,tsconfig.tsbuildinfo,next-env.d.ts,postcss.config.mjs,\
tailwind.config.ts,.eslintrc.json,.gitignore,package-lock.json,README.md} 2>/dev/null || true

echo "==> Standalone size after prune:"
du -sh "$STANDALONE"

echo "==> Package with electron-builder"
cd "$ROOT/desktop"
npx electron-builder --mac "$@"

echo "==> Done. Artifacts in desktop/dist/"
ls -lh dist/*.dmg dist/*-mac.zip 2>/dev/null | awk '{print $5, $9}'

# MatterDock

**Read once, use everywhere.** A workspace for litigation matters: read case bundles, turn
highlights into typed, source-linked cards, and assemble court-ready artefacts from them.

This repo implements **Phase 0** of the PRD: matter workspace (F1), PDF reader with
highlight-to-card (F2), card board (F3), chronology (F4) and the List of Dates Word export.
Phase 1/2 features (traverse, brief generation, compilation, annexures, AI assists, auth)
are stubbed in the sidebar and not yet implemented.

## Stack

- Next.js 14 (App Router) · TypeScript · Tailwind
- Postgres via Prisma
- PDF rendering: pdf.js (`pdfjs-dist`) — worker served from `public/`
- Word export: `docx` · sample PDFs: `pdf-lib`
- Tests: Playwright

## Local development

```bash
npm install                       # also copies the pdf.js worker to public/
createdb matterdock               # any Postgres ≥ 14; set DATABASE_URL in .env
npx prisma migrate dev
npm run db:seed                   # one sample matter with two generated PDFs + cards
npm run dev                       # http://localhost:3000
```

`.env`:

```
DATABASE_URL="postgresql://<user>@localhost:5432/matterdock"
STORAGE_DIR="./storage"
```

## Docker (pilot deployment)

```bash
docker compose up --build         # app on :3000, Postgres with persistent volume
```

Migrations run automatically on container start. Uploaded PDFs live in the `appstorage`
volume behind the `Storage` interface (`src/lib/storage.ts`), swappable for S3-compatible
object storage later.

## Tests

```bash
npm run test:e2e                  # requires the seeded database
```

Covers the two Phase 0 acceptance flows: highlight → typed card → persistent highlight →
chronology, and the List of Dates docx export.

## How it fits together

- **Ingestion** (`src/lib/pdf/extract.ts`): on upload, pdf.js extracts per-page text and
  line positions; `paraMap.ts` detects numbered paragraphs (`12.`, `(i)`, `(a)`, Roman) and
  stores markers. Page text is stored per page for search. Scanned PDFs are flagged
  "no text layer".
- **Cards** carry document, page, detected para, exact quote and normalized highlight
  rects. Highlight colour is keyed to card type (`src/lib/labels.ts`).
- **Chronology** entries are derived rows synced from Date cards
  (`src/lib/chronology.ts`) plus manual rows; same-date/similar-text pairs are flagged as
  duplicates.
- **List of Dates** export (`/api/matters/:id/exports/list-of-dates`) produces the
  conventional two-column table, DD.MM.YYYY, Times New Roman 14, synopsis placeholder;
  house style constants live in `src/lib/houseStyle.ts`.

## Known Phase 0 limitations

- No auth (single-user pilot; auth abstraction planned per PRD §8).
- Board renders columns without list virtualisation; fine to ~1k cards.
- Reader has page-jump, zoom, in-document search; thumbnails not yet implemented.
- OCR out of scope; scanned PDFs are read-only.

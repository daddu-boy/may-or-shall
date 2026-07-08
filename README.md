# May or Shall

*(formerly MatterDock)*

**Read once, use everywhere.** A workspace for litigation matters: read case bundles, turn
highlights into typed, source-linked cards, and assemble court-ready artefacts from them.

Implements the PRD through Phase 2 features: matter workspace (F1), PDF reader with
highlight-to-card (F2), card board (F3), chronology (F4), para-wise traverse for written
statements (F5), AI brief/submissions/judge-note generation (F6), convenience compilation
builder (F7), annexure manager with live references (F8), and Word/PDF exports (F9).
Not yet implemented: auth (single-user pilot) and pilot analytics (F10).

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
# optional — enables AI features (traverse drafting, brief generation)
ANTHROPIC_API_KEY="sk-ant-..."
# optional model overrides
MODEL_DRAFTING="claude-sonnet-5"
MODEL_BRIEF="claude-opus-4-8"
```

Without `ANTHROPIC_API_KEY`, every AI button degrades to a clear error; everything else
works. AI can also be disabled per matter (toggle on the Drafts page) for matters under
confidentiality restrictions.

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

- **Traverse (F5)**: designating the plaint splits its per-page text into sequentially
  numbered paragraphs (`src/lib/paraSplit.ts`), one editable row each. The deemed-admission
  guard lists rows still `not_started`/`denied_bare` (Order VIII Rule 5 CPC). Per-row AI
  drafts a specific denial from the para + attached cards. Exports a written-statement
  skeleton docx.
- **Drafts (F6)**: `src/lib/ai.ts` wraps the Anthropic API server-side (streaming, token
  metadata logged, content stored only in the artefact). Prompt templates live in
  `/prompts` with a grounding rule: cards only, bridging sentences in [brackets], trailing
  source chips. Regeneration always creates a new version.
- **Compilation (F7)**: `src/lib/compilation.ts` resolves cards → document page ranges
  (full or cited ± N context pages), builds one PDF with an index whose page numbers match
  the continuous pagination stamped on every page, plus an outline bookmark per document.
- **Annexures (F8)**: ordered registry maps documents to labels (`Annexure P-1`, prefix
  configurable / derived from side). Typing `@` in any rich text editor inserts a live
  reference stored as `<span data-annexure-id>`; reordering renumbers labels and rewrites
  every live reference across traverse rows and drafts (`src/lib/annexures.ts`). Word
  exports flatten references to text.

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

## Known limitations

- No auth (single-user pilot; auth abstraction planned per PRD §8) and no F10 analytics.
- Board renders columns without list virtualisation; fine to ~1k cards.
- Reader has page-jump, zoom, in-document search; thumbnails not yet implemented.
- OCR out of scope; scanned PDFs are read-only.
- Rich text is a pragmatic subset (paragraphs, headings, bold/italic, bullets); docx export
  converts that subset only.

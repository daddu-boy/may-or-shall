# May or Shall

**Read once, use everywhere.** A workspace for litigation matters: read your case bundle,
turn highlights into reusable, source-linked notes ("cards"), and assemble court-ready
documents from them — the chronology, the written statement, briefs, and compilations.

## What it does

- **Read & highlight.** Upload the matter's PDFs. Select text in the built-in reader and
  one click saves it as a **card** — typed as a Fact, Date, Issue, Admission, Evidence,
  Case law, Argument or Question — permanently carrying its exact quote and source
  (document, page, paragraph). Highlights stay painted on the PDF, colour-coded by type.
- **Clip from the web.** A companion Chrome extension saves selected text from any website
  (judgments, news, orders) as cards, with the page URL as the source.
- **Think on a board.** All cards on a kanban-style board — group by type, document, tag
  or date; filter, search, tag cards by issue, and drag to reorder.
- **Chronology & List of Dates.** Date cards assemble themselves into a chronology.
  Export it as a court-format Word document (two-column, DD.MM.YYYY, synopsis section,
  Times New Roman 14).
- **Para-wise traverse.** Designate the plaint and it splits into one editable row per
  paragraph for drafting the written statement, with a review mode that flags every
  paragraph still lacking a specific denial (the Order VIII Rule 5 CPC deemed-admission
  risk). Exports a written-statement skeleton to Word.
- **AI first drafts, grounded.** Generate a senior counsel brief, written submissions, or
  a judge's note using Claude — strictly from your cards, never from raw PDFs. Every
  factual sentence carries a source citation; anything the AI adds as connective text is
  wrapped in [square brackets] for review. Regenerating creates a new version, never
  overwrites. AI can be switched off per matter.
- **Convenience compilation.** Pick cards or issues and get a single PDF of exactly the
  pages they cite (plus context pages if you want), with an index page that matches the
  stamped continuous pagination and a bookmark per document.
- **Annexure manager.** An ordered registry maps documents to labels (Annexure P-1,
  R-2…). Drag to reorder and every live `@`-reference in your drafts renumbers instantly.
  Exports an Index of Annexures.
- **Draft in Word.** A companion Word add-in shows your card base beside the document and
  plots selected cards into the draft as labelled, source-cited blocks — ready for you (or
  any AI add-in you use, like Claude or Copilot) to draft from.

## Quick start (run it locally)

```bash
git clone https://github.com/daddu-boy/may-or-shall.git && cd may-or-shall
npm install                       # also sets up the PDF engine
createdb mayorshall               # any PostgreSQL ≥ 14
cp .env.example .env              # then set DATABASE_URL to your database
npx prisma migrate deploy
npm run db:seed                   # a sample matter with two generated PDFs + cards
npm run dev                       # http://localhost:3000
```

Or with Docker: `docker compose up --build` (app on :3000, PostgreSQL included,
migrations run automatically).

`.env` options:

```
DATABASE_URL="postgresql://<user>@localhost:5432/mayorshall"
STORAGE_DIR="./storage"
# optional — enables the AI drafting features
ANTHROPIC_API_KEY="sk-ant-..."
# optional model overrides
MODEL_DRAFTING="claude-sonnet-5"
MODEL_BRIEF="claude-opus-4-8"
```

Without `ANTHROPIC_API_KEY`, the AI buttons show a clear message and everything else
works normally.

## Install the clients (for users)

**Chrome / Edge extension** — no build needed:

1. Download `may-or-shall-web-clipper.zip` from the latest
   [GitHub release](https://github.com/daddu-boy/may-or-shall/releases), unzip it.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select
   the unzipped folder.
3. The extension talks to *your* May or Shall app (see Quick start above). In the
   extension **Options** set the App URL, paste an API token (app → Settings → API
   tokens) and pick a matter. Select text on any page to clip; the toolbar popup also
   takes rough free-text notes.

After updating the extension files, hit ↻ reload on `chrome://extensions` **and refresh
any pages that were already open** — old tabs keep running the previous version.

**Word add-in:**

1. Run the app over HTTPS (`npx office-addin-dev-certs install` once, then
   `npm run dev:addin`), or host it under a proper HTTPS domain.
2. Download `may-or-shall-word-manifest.xml` from the release (edit the URLs if your app
   is not at `https://localhost:3000`) and sideload it: on Mac, copy it to
   `~/Library/Containers/com.microsoft.Word/Data/Documents/wef/`; on Windows/M365, use
   centralized deployment or a network-share catalog.
3. In Word: Home ribbon → **Cards** (or Insert → Add-ins → Developer Add-ins).

Both clients are thin front-ends: your matter data stays in your own May or Shall server.

## Stack

- Next.js 14 (App Router) · TypeScript · Tailwind · PostgreSQL via Prisma
- PDF rendering with pdf.js; Word export with `docx`; PDF compilation with `pdf-lib`;
  rich text with Tiptap; AI via the Anthropic API (server-side only, prompts versioned
  in `/prompts`)
- Tests: Playwright (`npm run test:e2e`, needs the seeded database); the extension has
  its own end-to-end check (`node scripts/verify-extension.mjs`)

## How the pieces fit

On upload, the app extracts each PDF's text and detects numbered paragraphs, so a
highlight knows its page **and** paragraph. Cards are the atomic unit; the chronology,
traverse, briefs and compilation are all assembled from the card base. Chronology rows
sync from Date cards automatically, and near-duplicate rows (same date, similar text) get
flagged for merging. API tokens (Settings page) authenticate the extension and any other
external client; set `API_REQUIRE_TOKEN=1` when the backend is reachable beyond localhost.

## Current limitations

- Single-user pilot: no login yet (API tokens exist for the companion clients).
- Scanned PDFs without a text layer can't be highlighted (no OCR yet).
- Rich text is a pragmatic subset (paragraphs, headings, bold/italic, bullets); Word
  export converts that subset.

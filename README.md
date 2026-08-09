# May or Shall

A workspace for litigation matters. Read the case bundle, turn every highlight into a
reusable note that permanently remembers where it came from, and assemble the chronology,
the written statement, the compilation and the annexure index out of those notes instead of
retyping them.

Built by a practising litigator for the way Indian litigation actually runs — para-wise
traverse, list of dates, convenience compilation, Annexure P-1.

**Try it: [app.mayorshall.com](https://app.mayorshall.com)** — sign in with your email
address, no password and nothing to install. A sample matter with a real plaint is waiting
in your account so you can see the whole flow before uploading anything of your own.

## What it does

- **Read & highlight.** Upload the matter's PDFs. Select text in the built-in reader and
  one click saves it as a **card** — typed as a Fact, Date, Issue, Admission, Evidence,
  Case law, Argument or Question — permanently carrying its exact quote and source
  (document, page, paragraph). Highlights stay painted on the PDF, colour-coded by type.
- **Clip from the web.** A companion Chrome/Edge extension saves selected text from any
  website — a judgment on Indian Kanoon, a news report, an order on a court site — as a
  card, with the page URL as its source.
- **Think on a board.** All cards on a kanban-style board — group by type, document, tag
  or date; filter, search, tag by issue, and drag to reorder.
- **Chronology & List of Dates.** Date cards assemble themselves into a chronology.
  Export it as a court-format Word document (two-column, DD.MM.YYYY, synopsis section,
  Times New Roman 14).
- **Para-wise traverse, with a deemed-admission guard.** Designate the plaint and it splits
  into one editable row per paragraph for drafting the written statement. Review mode flags
  every paragraph still lacking a specific denial — the Order VIII Rule 5 CPC risk — so a
  paragraph cannot go unanswered by accident. Exports a written-statement skeleton to Word.
- **Convenience compilation.** Pick cards or issues and get a single PDF of exactly the
  pages they cite (plus context pages if you want), with an index page that matches the
  stamped continuous pagination and a bookmark per document.
- **Annexure manager.** An ordered registry maps documents to labels (Annexure P-1,
  R-2…). Drag to reorder and every live `@`-reference in your drafts renumbers instantly.
  Exports an Index of Annexures.
- **Draft in Word.** A companion Word add-in shows your card base beside the document and
  plots selected cards into the draft as labelled, source-cited blocks — ready for you, or
  for any AI add-in you already use in Word, to draft from.
- **AI first drafts, grounded.** Optionally generate a senior counsel brief, written
  submissions or a judge's note using Claude — strictly from your cards, never from the raw
  PDFs. Every factual sentence carries a source citation; connective text the model adds is
  wrapped in [square brackets] for review. Regenerating creates a new version rather than
  overwriting, and AI can be switched off per matter.

## How the pieces fit

On upload, the app extracts each PDF's text and detects numbered paragraphs, so a highlight
knows its page **and** its paragraph. Cards are the atomic unit: the chronology, the
traverse, the briefs and the compilation are all assembled from the card base, never
retyped. Chronology rows sync from Date cards automatically, and near-duplicate rows (same
date, similar text) are flagged for merging.

## Run your own copy

May or Shall is free software under the [GNU AGPL v3](LICENSE). You are welcome to run it
yourself. If you modify it and run it as a network service, you must offer your users the
modified source (AGPL §13).

Requirements: Node 20+ and a PostgreSQL database.

```bash
git clone https://github.com/daddu-boy/may-or-shall.git && cd may-or-shall
npm install                       # also sets up the PDF engine
cp .env.example .env              # then fill in DATABASE_URL, AUTH_SECRET, RESEND_API_KEY
npm run db:migrate                # creates the schema
npm run dev                       # http://localhost:3000
```

Or with Docker: `docker compose up --build` (app on :3000, migrations run automatically).
For a hosted deployment on Railway — database, disk and domain — see [DEPLOY.md](DEPLOY.md).

### Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `AUTH_SECRET` | Session secret — `openssl rand -base64 33` (required) |
| `AUTH_URL` | The app's public URL (required in production) |
| `RESEND_API_KEY` | [Resend](https://resend.com) key, used to send sign-in links |
| `EMAIL_FROM` | Sender for those emails, e.g. `May or Shall <hello@example.com>` |
| `STORAGE_DIR` | Where uploaded PDFs are written (default `./storage`) |
| `ANTHROPIC_API_KEY` | *Optional* — enables the AI drafting features |
| `MODEL_DRAFTING`, `MODEL_BRIEF` | *Optional* model overrides |
| `PROMPTS_DIR` | *Optional* — where the AI prompt templates live |

Without `ANTHROPIC_API_KEY` the AI buttons explain that they're unconfigured and everything
else works normally.

The AI features also need prompt templates, which are **not** distributed with this repo. To
enable them, create a `prompts/` folder in the project root with four markdown files
(`traverse-response.md`, `senior-brief.md`, `written-submissions.md`, `judge-note.md`). Each
is a plain prompt with `{{placeholder}}` variables filled in at runtime — see `src/lib/ai.ts`
and its call sites for the variables each template receives.

## The clients

**Chrome / Edge extension** — install
[May or Shall — Web Clipper](https://chromewebstore.google.com/detail/jcdaggdinfgihjbjgmpieohgehalpfac)
from the Chrome Web Store, then sign in to the web app. That's the entire setup: being
signed in *is* the connection, so there is no token to copy and nothing to configure. Select
text on any page and the card-type popover appears. If you run your own server, put its
address in the extension's **Options**.

To work on the extension itself, load the `extension/` folder unpacked on
`chrome://extensions` with Developer mode on.

**Word add-in** — download `may-or-shall-word-manifest-hosted.xml` from the latest
[release](https://github.com/daddu-boy/may-or-shall/releases) and sideload it: on Mac, copy
it to `~/Library/Containers/com.microsoft.Word/Data/Documents/wef/` (create `wef` if it
doesn't exist) and restart Word; on Windows/M365, use Insert → Add-ins → Upload My Add-in,
or centralized deployment. Then Home ribbon → **Cards**. The pane signs in with a code
emailed to you, because a task pane can't share the browser's session. Details and the
local-development variant are in [office-addin/README.md](office-addin/README.md).

## Stack

- Next.js 14 (App Router) · TypeScript · Tailwind · PostgreSQL via Prisma
- Auth.js v5 with database sessions; passwordless sign-in links sent through Resend
- PDF rendering with pdf.js; Word export with `docx`; PDF compilation with `pdf-lib`;
  rich text with Tiptap; AI via the Anthropic API, server-side only
- Tests: Playwright (`npm run test:e2e`); the extension has its own end-to-end check
  (`node scripts/verify-extension.mjs`)

## Current limitations

- Scanned PDFs without a text layer can't be highlighted — there's no OCR yet.
- Rich text is a pragmatic subset (paragraphs, headings, bold/italic, bullets); Word export
  converts that subset.
- The Word add-in is distributed by sideloading, not through AppSource.

## Licence

**GNU Affero General Public License v3.0 or later.** Copyright (c) 2026 Sidharth Kapoor.

You are free to read, run, modify and share this software. The one condition that matters:
if you run a modified version as a network service, you must make your modified source
available to its users (AGPL §13). See [LICENSE](LICENSE).

The licence covers the code. It does not cover the name "May or Shall", the brand assets, or
the hosted service at https://app.mayorshall.com — see [NOTICE](NOTICE). If you run your own
copy, please give it a different name.

May or Shall is not a law firm and does not give legal advice. Anything it drafts, extracts
or exports must be reviewed by the lawyer responsible for the matter.

# May or Shall

A workspace for litigation matters. Read the case bundle, turn every highlight into a
reusable note that permanently remembers where it came from, and assemble the chronology,
the written statement, the compilation and the annexure index out of those notes instead of
retyping them.

Built by a practising litigator for the way Indian litigation actually runs: traverse
paragraph by paragraph, list of dates, convenience compilation, annexure labels.

**Try it: [app.mayorshall.com](https://app.mayorshall.com).** Sign in with your email
address. There is no password and nothing to install. A sample matter with a real plaint is
waiting in your account, so you can see the whole flow before uploading anything of your own.

## What it does

- **Read and highlight.** Upload the matter's PDFs. Select text in the built in reader and
  one click saves it as a **card**, typed as a Fact, Date, Issue, Admission, Evidence, Case
  law, Argument or Question, permanently carrying its exact quote and its source (document,
  page, paragraph). Highlights stay painted on the PDF, coloured by type.
- **Clip from the web.** A companion Chrome and Edge extension saves selected text from any
  website, whether a judgment on Indian Kanoon, a news report or an order on a court site,
  as a card with the page URL as its source.
- **Think on a board.** All cards on a board. Group them by type, document, tag or date;
  filter, search, tag by issue, and drag to reorder.
- **Chronology and List of Dates.** Date cards assemble themselves into a chronology.
  Export it as a Word document in court format: two columns, DD.MM.YYYY, a synopsis
  section, Times New Roman 14.
- **Traverse, with a guard against deemed admission.** Designate the plaint and it splits
  into one editable row per paragraph for drafting the written statement. Review mode flags
  every paragraph that still lacks a specific denial, which is the risk under Order VIII
  Rule 5 CPC, so no paragraph goes unanswered by accident. Exports a written statement
  skeleton to Word.
- **Convenience compilation.** Pick cards or issues and get a single PDF of exactly the
  pages they cite, plus context pages if you want them, with an index page that matches the
  stamped continuous pagination and a bookmark for each document.
- **Annexure manager.** An ordered registry maps documents to their annexure labels. Drag to
  reorder and every live `@` reference in your drafts renumbers instantly. Exports an Index
  of Annexures.
- **Draft in Word.** A companion Word add in shows your card base beside the document and
  plots selected cards into the draft as labelled blocks that carry their citations, ready
  for you, or for any AI add in you already use in Word, to draft from.
- **AI first drafts, grounded.** Optionally generate a senior counsel brief, written
  submissions or a judge's note using Claude, strictly from your cards and never from the
  raw PDFs. Every factual sentence carries a source citation, and connective text the model
  adds is wrapped in [square brackets] for review. Regenerating creates a new version rather
  than overwriting, and AI can be switched off for any matter.

## How the pieces fit

On upload, the app extracts each PDF's text and detects numbered paragraphs, so a highlight
knows its page **and** its paragraph. Cards are the atomic unit: the chronology, the
traverse, the briefs and the compilation are all assembled from the card base, never
retyped. Chronology rows sync from Date cards automatically, and rows that look like
duplicates (same date, similar text) are flagged for merging.

## Run your own copy

May or Shall is free software under the [GNU AGPL v3](LICENSE). You are welcome to run it
yourself. If you modify it and run it as a network service, you must offer your users the
modified source (AGPL §13).

Requirements: Node 20 or later, and a PostgreSQL database.

```bash
git clone https://github.com/daddu-boy/may-or-shall.git && cd may-or-shall
npm install                       # also sets up the PDF engine
cp .env.example .env              # then fill in DATABASE_URL, AUTH_SECRET, RESEND_API_KEY
npm run db:migrate                # creates the schema
npm run dev                       # http://localhost:3000
```

Or with Docker: `docker compose up --build`, which serves the app on port 3000 and runs
migrations automatically. For a hosted deployment on Railway, with database, disk and
domain, see [DEPLOY.md](DEPLOY.md).

### Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `AUTH_SECRET` | Session secret, from `openssl rand -base64 33` (required) |
| `AUTH_URL` | The app's public URL (required in production) |
| `RESEND_API_KEY` | [Resend](https://resend.com) key, used to email sign in links |
| `EMAIL_FROM` | Sender for those emails, such as `May or Shall <hello@example.com>` |
| `STORAGE_DIR` | Where uploaded PDFs are written (default `./storage`) |
| `ANTHROPIC_API_KEY` | Optional. Enables the AI drafting features |
| `MODEL_DRAFTING`, `MODEL_BRIEF` | Optional model overrides |
| `PROMPTS_DIR` | Optional. Where the AI prompt templates live |

Without `ANTHROPIC_API_KEY` the AI buttons explain that they are unconfigured, and
everything else works normally.

The AI features also need prompt templates, which are **not** distributed with this repo. To
enable them, create a `prompts/` folder in the project root holding four markdown files:
`traverse-response.md`, `senior-brief.md`, `written-submissions.md` and `judge-note.md`.
Each is a plain prompt with `{{placeholder}}` variables filled in at runtime. See
`src/lib/ai.ts` and its call sites for the variables each template receives.

## The clients

**Chrome and Edge extension.** Install the
[May or Shall Web Clipper](https://chromewebstore.google.com/detail/jcdaggdinfgihjbjgmpieohgehalpfac)
from the Chrome Web Store, which works in Edge too, then sign in to the web app. That is the
entire setup: being signed in *is* the connection, so there is no token to copy and nothing
to configure. Select text on any page and the card type popover appears. If you run your own
server, put its address in the extension's **Options**.

To work on the extension itself, load the `extension/` folder unpacked on
`chrome://extensions` with Developer mode on.

**Word add in.** Download `may-or-shall-word-manifest-hosted.xml` from the latest
[release](https://github.com/daddu-boy/may-or-shall/releases) and sideload it. On Mac, copy
it to `~/Library/Containers/com.microsoft.Word/Data/Documents/wef/`, creating `wef` if it
does not exist, and restart Word. On Windows and Microsoft 365, use Insert → Add-ins →
Upload My Add-in, or centralized deployment. Then go to the Home ribbon and click **Cards**.
The pane signs in with a code emailed to you, because a task pane cannot share the browser's
session. Details and the local development variant are in
[office-addin/README.md](office-addin/README.md).

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind, PostgreSQL via Prisma
- Auth.js v5 with database sessions, and passwordless sign in links sent through Resend
- PDF rendering with pdf.js, Word export with `docx`, PDF compilation with `pdf-lib`, rich
  text with Tiptap, and AI through the Anthropic API, called only on the server
- Tests: Playwright (`npm run test:e2e`). The extension has its own check that runs end to
  end (`node scripts/verify-extension.mjs`)

## Current limitations

- Scanned PDFs without a text layer cannot be highlighted, because there is no OCR yet.
- Rich text is a pragmatic subset: paragraphs, headings, bold, italic and bullets. Word
  export converts that subset.
- The Word add in is distributed by sideloading rather than through AppSource.

## Licence

**GNU Affero General Public License v3.0 or later.** Copyright (c) 2026 Sidharth Kapoor.

You are free to read, run, modify and share this software. The one condition that matters:
if you run a modified version as a network service, you must make your modified source
available to its users (AGPL §13). See [LICENSE](LICENSE).

The licence covers the code. It does not cover the name "May or Shall", the brand assets, or
the hosted service at https://app.mayorshall.com. See [NOTICE](NOTICE). If you run your own
copy, please give it a different name.

May or Shall is not a law firm and does not give legal advice. Anything it drafts, extracts
or exports must be reviewed by the lawyer responsible for the matter.

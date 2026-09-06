# Working on May or Shall

Operational notes for a coding agent. Most of this is not deducible from the
code, and several items are traps that have already cost real time.

May or Shall is a litigation matter workspace: Next.js 14 App Router,
TypeScript, Tailwind, Prisma with PostgreSQL, Auth.js v5 with database
sessions, hosted on Railway at https://app.mayorshall.com. AGPL v3.

## Setting up

```bash
npm install                 # postinstall copies the pdf.js worker into public/
cp .env.example .env        # then fill it in, see below
npm run db:migrate          # creates the schema
npm run dev                 # http://localhost:3000
```

Four things are gitignored and absent from a fresh clone, so the app will not
run without them:

- `.env`: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `STORAGE_DIR`
- `prompts/`: four markdown templates the AI features read. Without them those
  features report themselves unconfigured, and everything else works
- `storage/`: uploaded PDFs
- `scripts/.tmp-*`: scratch scripts. Put throwaway probes there; they are
  ignored on purpose

**Point `DATABASE_URL` at a local Postgres.** Never at production. The live
database holds other people's case files.

## Things that will waste your afternoon

**Never run `npm run build` while `npm run dev` is running.** The production
build overwrites `.next`, which the dev server is reading, and the running app
dies with `Cannot find module './XXXX.js'`. Stop the dev server first, or build
on a different port. This has broken the local app three times.

**The reader must load through `next/dynamic` with `ssr: false`.** pdf.js
touches DOM APIs at module scope, so importing `Reader` statically gives a 500
on a hard page load that client side navigation hides. See
`src/components/reader/ReaderLoader.tsx`.

**pdf.js renders its text layer above the highlight overlay.** Any pointer
gesture on a highlight is swallowed by it. Do not attempt drag interactions on
highlights; it was tried and removed.

**Position floating panels by measuring them, not by passing in sizes.** Two
separate bugs came from hardcoded dimensions: the clipper panel hung 26px off
the right edge, and the card menu was clipped by the scrolling column it sat
in. Measure with `getBoundingClientRect`, clamp to the viewport, and flip above
the anchor when there is no room below.

**`str.replace()` in a patch script silently does nothing when the pattern does
not match.** Assert the pattern is present before replacing, or you will report
success on a file you never changed.

## Deploying

**A push to `main` does not deploy.** Railway is configured to build from a
commit you name, so pushing alone ships nothing and the site quietly stays on
the old code. Deployment is a GraphQL call:

```
POST https://backboard.railway.com/graphql/v2
mutation { serviceInstanceDeployV2(serviceId, environmentId, commitSha) }
```

Omitting `commitSha` redeploys stale code. The token lives in
`~/.railway/config.json` at `user.accessToken`, is short lived, and is
refreshed by running any `railway` CLI command, for example `railway whoami`.
The project, service and environment ids are in the Railway dashboard.

Poll `deployment(id) { status }` until `SUCCESS`, `FAILED` or `CRASHED`. A
build takes two to five minutes.

Migrations run themselves on deploy: the Dockerfile's CMD runs
`npx prisma migrate deploy` before starting the server.

## Verifying

**Check against production before saying something works.** The repository has
Playwright. Write a script under `scripts/.tmp-*`, sign in through
`/demo-signin`, drive the real site, and assert on what the page or the API
actually returns. Several bugs shipped because a change was reasoned about
rather than loaded.

**Assert on state, not on your assumptions about state.** Repeatedly, a test
"failed" because it toggled a control that was already open, or expected one
matter where the account had three. Read the state first, then act.

**Do not use the reviewer demo account for testing.** `reviewer@mayorshall.com`
is what OpenAI's reviewers sign into. Testing against it left two stray matters
and eight stray cards there and contributed to an app review rejection. Use
your own account or a throwaway one.

## Data and privacy

The published privacy policy says user data is used solely to provide the
service. When inspecting the production database, read counts, ids and
timestamps. Do not read the text of other people's cards or documents.

Deleting or overwriting production rows is destructive and irreversible. Print
exactly what would go, confirm, then do it.

## Conventions

**Commit messages** are a title line then prose explaining why, not what. End
with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Do not force push without being asked.

**User facing copy uses no em dashes or en dashes.** The owner does not use
them. Break sentences with commas, colons, parentheses or semicolons. Hyphens
inside compound words are fine.

**Card types**: the stored values never change. `MISC` displays as "Personal
note" and leads the list; labels vary by matter kind, so a project sees
"Source" where a case sees "Case law". See `src/lib/labels.ts` and use
`cardTypeLabel(type, kind)` rather than the raw map.

**Matter kind**: `CASE` or `PROJECT`. A project has no court or case number,
does not get Annexures or Editable rows, and those routes return 404 for it.

## Where things are

- `src/app/api/mcp/route.ts`: the MCP server, eight tools. ChatGPT connectors
  require tools named exactly `search` and `fetch` returning both
  `structuredContent` and a JSON text block
- `src/lib/oauth.ts` and `src/app/oauth/`: OAuth 2.1, PKCE, dynamic client
  registration, refresh rotation
- `src/lib/sampleMatter.ts`: the worked example seeded into every new account
- `src/lib/pdf/extract.ts`: text, paragraph map and imported highlights
- `src/components/board/`: the cards board
- `src/components/reader/`: the PDF reader
- `extension/`: the Chrome clipper, versioned in its own `manifest.json`
- `.github/workflows/reminders.yml`: the daily reminder trigger; Railway has
  no scheduler, so GitHub calls the app

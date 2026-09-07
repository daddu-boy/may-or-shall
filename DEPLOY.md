# Deploying the hosted app (Railway)

The app is a normal Node and Next server in a container, with a PostgreSQL database
and a disk for uploaded PDFs. Railway provides all three.

## Setting it up

1. **New Project → Deploy from GitHub repo** → pick `daddu-boy/may-or-shall`,
   branch `main`. Railway builds the `Dockerfile`.
2. **Add a database:** in the project, **New → Database → PostgreSQL**.
3. **Add a disk** to the app service: **Settings → Volumes → mount at `/data`**.
   PDFs are stored under `/data/storage`.
4. **Set the service variables** (Variables tab):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
   | `AUTH_SECRET` | a long random string (`openssl rand -base64 33`) |
   | `AUTH_URL` | the app's public URL, such as `https://may-or-shall.up.railway.app` |
   | `AUTH_TRUST_HOST` | `true` |
   | `RESEND_API_KEY` | from resend.com → API Keys |
   | `EMAIL_FROM` | `May or Shall <onboarding@resend.dev>`, or your verified domain sender |
   | `STORAGE_DIR` | `/data/storage` |
   | `ANTHROPIC_API_KEY` | *(optional)* your key, to enable the AI drafting |

5. **Generate a public domain:** Settings → Networking → Generate Domain. Put
   that URL in `AUTH_URL` (step 4) and redeploy.

Migrations run automatically on every deploy, through `prisma migrate deploy` in
the Dockerfile, so the schema is created on first boot.

## Custom domains

Railway needs **two** DNS records for a custom domain, not one: the CNAME it
shows you, and a TXT record at `_railway-verify.<subdomain>` carrying the
verification token. The dashboard lists both. If the certificate sits at
VALIDATING_OWNERSHIP for a long time, the TXT record is usually the one missing.

## After it's live

- Visit the domain and sign in with your email address. A link arrives by email,
  one click signs you in, and you have an account. A sample matter is created for
  you the first time.
- The Chrome extension connects itself the moment you are signed in. Point it at
  your own domain in the extension's **Options** if you are not using
  app.mayorshall.com. The Word add in signs in with a code emailed to you.

## OCR and source review upgrade

Apply `npx prisma migrate deploy` before starting the updated app. The migration
adds original-PDF provenance, extraction reports and AI source-review snapshots.
Docker applies migrations on startup and installs OCRmyPDF with English data.
For non-Docker servers install OCRmyPDF and its native dependencies separately
(`brew install ocrmypdf` on macOS). Set `OCRMYPDF_BIN` if it is not on PATH.
`OCR_LANGUAGES` defaults to `eng`; additional languages require matching Tesseract
language packs on the server. OCR processes document content locally.

Uploads are bounded at 50 MB / 500 pages. Automatic OCR runs only for bundles with
sparse text pages, and at most 100 such pages per upload. OCR preserves existing
text pages (`--skip-text`) and produces a separate searchable PDF without replacing
the original. Page-level warnings remain when extraction is sparse. A page that
has a typed header over a scan may be skipped by OCRmyPDF; use an externally OCRed
copy for those pages. Digitally signed/encrypted PDFs are not forcibly rewritten.

Processing currently runs within the upload/retry request, with one OCR process
per application process, one OCR CPU job, a 30-second per-page OCR limit and a
180-second overall OCR limit. Allow a 300-second request timeout at the reverse
proxy, and configure a request-body limit of 51 MB there as well (multipart data is
parsed by Next before the file-size check). Busy, failed or unavailable OCR leaves
the original readable and displays a retry action; it does not discard the upload.
For sustained high-volume ingestion, move this bounded processor into a durable
job worker before increasing concurrency or limits. This release does not add a
persistent background queue.

Back up both PostgreSQL and STORAGE_DIR. Original PDFs and searchable derivatives
must be retained together. Existing documents can be processed with Retry OCR in
Documents. OCR adds text for selection, card capture, search and traverse extraction;
users must still compare recognized quotes, dates and paragraph numbers to the image.

AI templates remain deployment-owned. Their prose instructions are supplemented by
a server-owned structured JSON contract. Missing templates disable AI controls and
return a 503 before a paid generation. Invalid source IDs, unmatched quotations,
uncited facts and incomplete model output are rejected before saving. Existing
manual drafts continue to work. The source-review panel stores the generated claim
and evidence snapshots; it explicitly becomes historical after edits. It validates
source references and quoted excerpts, not whether evidence proves a claim.

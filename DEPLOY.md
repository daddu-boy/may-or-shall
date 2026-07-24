# Deploying the hosted app (Railway)

The app is a normal Node/Next server in a container, with a PostgreSQL database
and a disk for uploaded PDFs. Railway provides all three.

## One-time setup

1. **New Project → Deploy from GitHub repo** → pick `daddu-boy/may-or-shall`,
   branch `hosted`. Railway builds the `Dockerfile`.
2. **Add a database:** in the project, **New → Database → PostgreSQL**.
3. **Add a disk** to the app service: **Settings → Volumes → mount at `/data`**
   (PDFs are stored under `/data/storage`).
4. **Set the service variables** (Variables tab):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
   | `AUTH_SECRET` | a long random string (`openssl rand -base64 33`) |
   | `AUTH_URL` | the app's public URL, e.g. `https://may-or-shall.up.railway.app` |
   | `AUTH_TRUST_HOST` | `true` |
   | `RESEND_API_KEY` | from resend.com → API Keys |
   | `EMAIL_FROM` | `May or Shall <onboarding@resend.dev>` (or your verified domain sender) |
   | `STORAGE_DIR` | `/data/storage` |
   | `ANTHROPIC_API_KEY` | *(optional)* your key, to enable the AI drafting |

5. **Generate a public domain:** Settings → Networking → Generate Domain. Put
   that URL in `AUTH_URL` (step 4) and redeploy.

Migrations run automatically on every deploy (`prisma migrate deploy` in the
Dockerfile), so the schema is created on first boot.

## After it's live

- Visit the domain, sign in with your email (magic link), and you have an
  account. Create an API token under **Settings** for the Chrome extension and
  the Word add-in — both point at your hosted URL instead of localhost.

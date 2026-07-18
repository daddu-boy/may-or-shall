# Testing instructions for Microsoft validation

May or Shall is a self-hosted product: the add-in's task pane (hosted at
https://daddu-boy.github.io/may-or-shall/taskpane.html) is a viewer over a card database
that lives on the user's own server. To exercise the add-in end to end, run the free
open-source server locally (about 3 minutes with Docker):

1. `git clone https://github.com/daddu-boy/may-or-shall && cd may-or-shall`
2. `docker compose up --build`
   — the app starts on http://localhost:3000 (migrations run automatically).
   Then load the sample data (one command, from a second terminal):
   `docker compose exec app npx tsx prisma/seed.ts`
   — this creates the sample matter "Sharma Infra Projects v. National Buildcon" with
   cards of every type.
3. Create an API token in the app: open http://localhost:3000 → Settings → API tokens →
   Create token. Copy the `mos_…` value.
4. Sideload the manifest and open the add-in in Word (Home ribbon → Cards).
5. In the pane's first-run settings enter:
   - App URL: `http://localhost:3000`
   - API token: the value from step 3
   and press "Save & connect". The sample matter's cards appear.
6. Select any cards and press "Plot selected into document" — each card is inserted at
   the cursor as a Word content control titled with its type and source citation.

Notes for the tester:

- The pane never sends data anywhere except the server URL the tester entered in step 5.
- Without a configured server the pane shows only the settings screen; this is by design
  (there is no vendor cloud — each law practice runs its own instance).
- The companion Chrome extension (already published,
  https://chromewebstore.google.com/detail/jcdaggdinfgihjbjgmpieohgehalpfac) uses the same
  server URL + token; a passage clipped in Chrome appears in this pane on refresh.

# May or Shall — Word add-in

A task-pane add-in that shows the matter's card base beside your draft and **plots** selected
cards into the document as labelled, source-cited blocks (each wrapped in a Word content
control tagged `mayorshall:card:<id>`).

The two-step composition: plot cards with this pane, then use any AI add-in you already have
in Word (Claude, Copilot, …) on the plotted material — the document itself is the channel
between add-ins, so no integration or partnership is needed. The plot format carries the
grounding: `[TYPE] body — "quote" (Document, p.X ¶Y)` or `(Title, URL)` for web captures.

## Setup (Mac, development)

1. **Trusted HTTPS for localhost** (Office add-ins require HTTPS), one time:

   ```sh
   npx office-addin-dev-certs install
   ```

2. **Run the app with HTTPS:**

   ```sh
   npm run dev:addin        # https://localhost:3000
   ```

3. **Sideload the manifest:**

   ```sh
   ./office-addin/sideload-mac.sh
   ```

4. Open Word → Home ribbon → **Cards** (May or Shall group). If missing, look under
   Insert → Add-ins → My Add-ins → Developer Add-ins, and restart Word once.

The task pane is served by the app at `/addin/taskpane` (same origin as the API, so no extra
auth is needed). Outside Word the same URL runs in copy-mode — cards copy to the clipboard as
formatted text instead of inserting.

## Firm deployment

Host the app under a proper HTTPS domain, replace `https://localhost:3000` in
`manifest.xml` with that origin, and distribute the manifest via Microsoft 365 centralized
deployment (no AppSource listing required).

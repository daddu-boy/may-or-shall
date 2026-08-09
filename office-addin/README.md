# May or Shall — Word add-in

A task-pane add-in that shows the matter's card base beside your draft and **plots** selected
cards into the document as labelled, source-cited blocks (each wrapped in a Word content
control tagged `mayorshall:card:<id>`).

The two-step composition: plot cards with this pane, then use any AI add-in you already have
in Word (Claude, Copilot, …) on the plotted material — the document itself is the channel
between add-ins, so no integration or partnership is needed. The plot format carries the
grounding: `[TYPE] body — "quote" (Document, p.X ¶Y)` or `(Title, URL)` for web captures.

## Install (against the hosted app)

1. Download `may-or-shall-word-manifest-hosted.xml` from the latest
   [release](https://github.com/daddu-boy/may-or-shall/releases). Nothing to edit — the pane
   is served from app.mayorshall.com.
2. Sideload it. **Mac:** copy the file to
   `~/Library/Containers/com.microsoft.Word/Data/Documents/wef/` (create `wef` if missing) and
   restart Word. **Windows / Microsoft 365:** Insert → Add-ins → Upload My Add-in, or push it
   to the firm through centralized deployment.
3. Word → Home ribbon → **Cards**. If it's missing, look under Insert → Add-ins → My Add-ins →
   Developer Add-ins and restart Word once.

**Signing in.** The pane asks for your email address and then for an 8-character code sent to
that address. It can't reuse your browser session: a task pane is a separate context, and a
sign-in link would open in your default browser rather than in Word. The code is valid for ten
minutes and works once.

The add-in is distributed this way rather than through AppSource, which requires a registered
company account.

## Development (against a local server)

Office add-ins must be served over HTTPS, including on localhost.

1. Trust a local certificate, one time:

   ```sh
   npx office-addin-dev-certs install
   ```

2. Run the app over HTTPS:

   ```sh
   npm run dev:addin        # https://localhost:3000
   ```

3. Sideload the local manifest:

   ```sh
   ./office-addin/sideload-mac.sh
   ```

`manifest.xml` points the pane at `https://localhost:3000/addin/taskpane`; edit the URLs if
your server runs elsewhere. Outside Word the same URL runs in copy-mode — cards copy to the
clipboard as formatted text instead of being inserted.

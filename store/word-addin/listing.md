# AppSource (Microsoft Partner Center) listing — copy-paste kit

## Offer basics

- **Offer type:** Office add-in
- **Add-in name:** May or Shall — Cards
- **Manifest:** `office-addin/manifest-hosted.xml` (task pane hosted on GitHub Pages)

## Short description (≤100 chars)

Plot your litigation matter's source-cited highlight cards into the document you are drafting.

## Long description

Turn your reading into reusable litigation work-product.

May or Shall is a self-hosted workspace for litigation matters: every highlight — made in
its PDF reader or clipped from any web page with the companion Chrome extension — becomes a
typed, source-linked "card" (a fact, a date, an admission, a case-law proposition…).

This add-in brings that card base into Word. Open the pane beside your draft, pick a
matter, filter and search your cards, and plot the ones you need into the document as
labelled, source-cited blocks. Every block carries its exact quote and citation (document,
page, paragraph — or URL for web clips), so anything you or an AI assistant drafts from
them inherits the grounding.

YOUR DATA STAYS YOURS

The pane connects only to the May or Shall server you configure — typically running on
your own machine or your firm's network, with an API token you create there. Nothing is
sent to us or any third party; no analytics, no tracking.

REQUIREMENTS

This is a companion to the open-source May or Shall app, which you run yourself
(instructions at https://github.com/daddu-boy/may-or-shall — `docker compose up` is
enough). In the pane's settings, enter your app's URL and an API token from the app's
Settings page. Use the same values as the Chrome extension and both clients share one
card base: clip in Chrome, plot in Word.

## Categories

Productivity; Document review (legal)

## Assets

- Listing icon 300×300: `store/word-addin/icon-300.png`
- Screenshot 1366×768: `store/word-addin/01-taskpane.png`
- Privacy policy URL: https://github.com/daddu-boy/may-or-shall/blob/main/extension/PRIVACY.md
- Support URL: https://github.com/daddu-boy/may-or-shall/issues
- EULA: use the Microsoft standard contract (or link the repo's MIT license)

## Test notes for Microsoft validation

See `test-notes.md` — validators need a running May or Shall server; docker compose gives
them one in ~3 minutes with seeded sample data.

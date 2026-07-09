# May or Shall — Web Clipper (Chrome/Edge extension)

Select text on any web page — a judgment on Indian Kanoon, a news report, an order on a court
website — and save it as a typed, source-linked card in your May or Shall matter. The page URL
and title become the card's source citation.

## Install (development)

1. In the app, create an API token: **Settings → API tokens → Create**.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select
   this `extension/` folder. (Edge: `edge://extensions`, same flow.)
3. Open the extension's **Options**, set the App URL (default `http://localhost:3000`), paste
   the token, **Save & test connection**, and pick a default matter.
4. Select text on any page → the card-type popover appears → one click saves the card.
   Switch the active matter anytime from the toolbar icon.

All API calls run from the extension's background worker, authenticated with your token.
Nothing is sent anywhere except your own May or Shall backend.

## Firefox / Safari

The code is standard Manifest V3 WebExtensions. Firefox: load via
`about:debugging` → "Load Temporary Add-on" (minor manifest tweaks may apply).
Safari: convert with `xcrun safari-web-extension-converter`.

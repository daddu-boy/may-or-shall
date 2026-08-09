# May or Shall — Web Clipper (Chrome/Edge extension)

Select text on any web page — a judgment on Indian Kanoon, a news report, an order on a court
website — and save it as a typed, source-linked card in your May or Shall matter. The page URL
and title become the card's source citation.

## Install

Install **May or Shall — Web Clipper** from the
[Chrome Web Store](https://chromewebstore.google.com/detail/jcdaggdinfgihjbjgmpieohgehalpfac)
(it works in Edge too), then sign in at [app.mayorshall.com](https://app.mayorshall.com).

That is the whole setup. Being signed in *is* the connection: the app hands the extension its
credentials silently, so there is no token to copy and nothing to configure. Select text on
any page and the card-type popover appears; switch the active matter from the toolbar icon.

Running your own May or Shall server? Put its address in the extension's **Options**.

## Development

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select
this `extension/` folder. (Edge: `edge://extensions`, same flow.) After changing these files,
hit ↻ reload on that page — tabs that were already open keep running the previous copy until
the worker re-injects into them.

All API calls run from the background service worker. Nothing is sent anywhere except your own
May or Shall backend.

## Firefox / Safari

The code is standard Manifest V3 WebExtensions. Firefox: load via `about:debugging` → "Load
Temporary Add-on" (minor manifest tweaks may apply). Safari: convert with
`xcrun safari-web-extension-converter`.

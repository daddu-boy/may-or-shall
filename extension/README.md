# May or Shall Web Clipper (Chrome and Edge extension)

Select text on any web page, whether a judgment on Indian Kanoon, a news report or an order
on a court website, and save it as a typed card in your May or Shall matter that carries its
citation. The page URL and title become the card's source.

## Install

Install the **May or Shall Web Clipper** from the
[Chrome Web Store](https://chromewebstore.google.com/detail/jcdaggdinfgihjbjgmpieohgehalpfac),
which works in Edge too, then sign in at [app.mayorshall.com](https://app.mayorshall.com).

That is the whole setup. Being signed in *is* the connection: the app hands the extension its
credentials silently, so there is no token to copy and nothing to configure. Select text on
any page and the card type popover appears. Switch the active matter from the toolbar icon.

Running your own May or Shall server? Put its address in the extension's **Options**.

## Development

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select
this `extension/` folder. Edge works the same way at `edge://extensions`. After changing
these files, hit reload on that page. Tabs that were already open keep running the previous
copy until the worker injects into them again.

All API calls run from the background service worker. Nothing is sent anywhere except your
own May or Shall backend.

## Firefox and Safari

The code is standard Manifest V3 WebExtensions. For Firefox, load it through
`about:debugging` using "Load Temporary Add-on"; minor manifest tweaks may apply. For Safari,
convert it with `xcrun safari-web-extension-converter`.

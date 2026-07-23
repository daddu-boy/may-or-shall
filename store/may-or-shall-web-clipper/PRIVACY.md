# May or Shall — Web Clipper: Privacy Policy

*Last updated: 12 July 2026*

**The short version: your data goes only to your own server. We never see it.**

The May or Shall Web Clipper is a companion to the self-hosted May or Shall litigation
workspace. It has one purpose: saving text you select on a web page (plus the page's URL
and title) as a note ("card") in a matter on a May or Shall server **that you configure
and control**.

## What the extension collects and where it goes

- **Text you explicitly select and choose to save**, an optional note you type, and the
  **URL and title of the page** you saved it from. This is sent to exactly one place: the
  May or Shall server address you entered in the extension's options (typically your own
  machine or your firm's server). It is never sent to the extension's developers or to
  any third party.
- **Your settings** — the server address, your API token, and your chosen matter — are
  stored using Chrome's built-in extension storage (`chrome.storage.sync`) on your
  browser profile. The token is created by, and only meaningful to, your own server.
- Nothing is collected passively. The extension reads page content **only** at the moment
  you select text and choose to save it. It does not track browsing history, does not
  record pages you visit, and contains no analytics, advertising, or telemetry of any
  kind.

## What the extension does not do

- No data is sold or shared with anyone.
- No data is transferred to the developer.
- No use of data for advertising, profiling, or creditworthiness purposes.
- No remotely hosted code is loaded or executed.

## Data retention and deletion

Saved cards live in the May or Shall server you pointed the extension at, under your (or
your organisation's) control — retention and deletion are governed there. Removing the
extension deletes its stored settings from your browser. Tokens can be revoked at any
time from your server's Settings page.

## Contact

Questions: open an issue at https://github.com/daddu-boy/may-or-shall/issues

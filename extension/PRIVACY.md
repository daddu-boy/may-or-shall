# May or Shall — Web Clipper: Privacy Policy

*Last updated: 29 July 2026*

**The short version: the clipper sends what you choose to save to your own May or Shall
account, and nothing else. No analytics, no advertising, no tracking, no third parties.**

The May or Shall Web Clipper is a companion to the May or Shall litigation workspace. It
has one purpose: saving text you select on a web page (plus the page's URL and title) as a
note ("card") in a matter in your May or Shall account.

## Where your data goes

By default the clipper talks to the hosted May or Shall service at
`https://app.mayorshall.com`, which is operated by the developer of
this extension (Sidharth Kapoor). If you run your own May or Shall server instead, you can
point the extension at that address in its Options, in which case your data goes only
there.

## What the extension collects

- **Text you explicitly select and choose to save**, an optional note you type, and the
  **URL and title of the page** you saved it from. This is sent to your May or Shall
  account so that each saved passage keeps its citation. It is never sold, and never
  shared with any third party.
- **Your account credential.** Signing in to May or Shall (by email link) issues the
  extension an API token identifying your account. The token is stored in your browser via
  `chrome.storage.sync` and is sent only to the May or Shall server.
- **Your settings** — the server address and the matter you are currently saving into —
  stored the same way.

Your May or Shall account itself is identified by the **email address** you sign in with.

Nothing is collected passively. The extension reads page content **only** at the moment
you select text and choose to save it. It does not track your browsing, does not record
pages you visit, and contains no analytics, advertising, or telemetry of any kind. Only
pages you deliberately clip from are ever recorded, and only as the source citation of a
card you created.

## What the extension does not do

- No data is sold or shared with third parties.
- No data is used for advertising, profiling, creditworthiness, or lending.
- No data is used for any purpose unrelated to saving your clips into your matter.
- No remotely hosted code is loaded or executed.

## Data retention and deletion

Saved cards live in your May or Shall account. You can delete individual cards, or a whole
matter, from the web app at any time, and you can revoke the extension's token under
Settings → API tokens. To have your account and all its data deleted, email the address
below. Removing the extension deletes its stored settings from your browser.

## Contact

Questions, or a deletion request: open an issue at
https://github.com/daddu-boy/may-or-shall/issues or email sdhkapr22@gmail.com

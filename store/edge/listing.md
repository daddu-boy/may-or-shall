# Edge Add-ons listing — copy-paste answers

Extension: **May or Shall — Web Clipper**
Package: build with `cd extension && zip -r -X ../store/may-or-shall-web-clipper-<version>.zip .`
Assets in this folder: `logo-300x300.png`, `promo-small-440x280.png`, `promo-large-1400x560.png`
(regenerate the tiles with `python3 scripts/make-store-tiles.py`). Screenshots: `../screenshots/`.

---

## Store listing

### Description

    May or Shall — Web Clipper turns the highlighting you already do into usable case material.

    When you are working on a matter you end up with a dozen browser tabs open: judgments, statutes, regulator circulars, news reports, and PDFs of the bundle itself. You highlight passages as you read — and then lose them.

    This extension saves those highlights straight into your matter.

    HOW IT WORKS

    Select any text on any page. A small popover appears. Pick what the passage is — a fact, a date, an issue, your argument, their argument, evidence, case law, an admission, a question — and it is saved as a card in the matter you are working on. Every card keeps the exact quote and the page it came from, so the citation is never lost.

    You can also click the toolbar icon to jot a rough note straight into the matter, with the current page attached as its source, and to see the clips you have saved most recently.

    SETTING IT UP

    Install the extension, open May or Shall, and sign in with your email — you get a one-click link, no password. That is the whole setup. The clipper connects itself to your account automatically; there is nothing to copy and paste and nothing technical to configure.

    WHAT YOU CAN DO WITH THE CLIPS

    Saved cards sit in your matter, where you can sort them, build a chronology, and pull them into a Word draft with their sources attached — so you can draft from exactly what you highlighted while reading.

    PRIVACY

    Nothing is collected passively. The extension reads a page only at the moment you select text and choose to save it. It has no analytics, no advertising and no tracking, and your clips go only to your own May or Shall account. Full policy: https://app.mayorshall.com/privacy

    To pause clipping at any time, use the switch in the extension's popup.

### Search terms (max 7, 30 chars each, 21 words total — uses 15)

    legal research
    web clipper
    litigation
    highlight to notes
    case law research
    lawyer tools
    save highlights

### Video URL
Leave blank.

---

## Properties / support

| Field | Value |
|---|---|
| Category | Productivity |
| Support / website URL | `https://github.com/daddu-boy/may-or-shall` |
| Support contact email | `sdhkapr22@gmail.com` |
| Privacy policy URL | `https://app.mayorshall.com/privacy` |

---

## Privacy page

### Single purpose description

    May or Shall — Web Clipper has one purpose: to save text you select on a web page as a categorised, source-linked note (a "card") in a matter in your May or Shall account.

    When you highlight text on any page, a small popover appears letting you pick a category — fact, date, issue, evidence, case law, admission, argument, question — and save the passage together with that page's URL and title, so the quote always keeps its citation. You can also type a short note in the toolbar popup and save it to the same matter.

    That is the entirety of the extension. It has no other feature: no advertising, no analytics, no tracking, and it does not modify the pages you visit.

### storage justification

    Stores only the user's own settings: the address of their May or Shall server, the API token that identifies their account, and the ID of the matter they are currently saving into. This is needed so the user does not have to re-authenticate or re-pick their matter every time they save a clip. Nothing else is stored, and the stored values never leave the browser except when authenticating to the user's own May or Shall server.

### activeTab justification

    When the user saves a note from the toolbar popup, the extension reads the current tab's URL and title at that moment only, in order to attach the page as the note's source citation. Preserving the source of every saved passage is the core value of the product for legal research. This is read solely in response to the user clicking "Save note" — never passively and never in the background.

### Host permission justification

    This is a research clipper for litigators, who read source material on arbitrary websites: court and judgment databases, government and regulatory portals, news reports, and PDFs opened in the browser. The user must be able to select and save text on any page they happen to be reading, and those sites cannot be enumerated in advance, so a broad host match is unavoidable.

    Page content is accessed only at the moment the user selects text and clicks a card-type button to save it. Nothing is read, logged, or transmitted passively, and no page is modified.

    Host access is also required to send the saved passage to the user's May or Shall account (https://app.mayorshall.com by default, or a self-hosted server address the user enters in Options), which is why http/https hosts are requested rather than a single fixed origin.

### Remote code

Select **"No, I am not using remote code."**

    All JavaScript ships inside the extension package. The extension loads no external scripts, uses no eval(), and pulls in no remotely hosted modules. Its only network calls are JSON API requests to the user's May or Shall server; no code is retrieved or executed from those responses.

### Data usage — tick these

| Category | Tick? |
|---|---|
| Personally identifiable information | **Yes** — the account is identified by the sign-in email address |
| Authentication information | **Yes** — the API token identifying the account |
| Web history | **Yes** — the URL/title of pages the user clips from, saved as citations |
| Website content (if listed) | **Yes** — the selected text itself |
| Health / financial / personal communications / location / user activity | No |

### Certification
Tick all three: no selling or transferring of user data, no use unrelated to the single
purpose, no use for creditworthiness or lending.

---

## Notes for certification (reviewers only)

    May or Shall — Web Clipper saves text you select on any web page into a matter in your May or Shall account, as a categorised, source-linked card.

    HOW TO TEST (no test credentials needed — sign-up is free, self-serve and instant)

    1. Install the extension. A welcome page opens.
    2. Go to https://app.mayorshall.com and enter ANY email address you control. You will be emailed a one-click sign-in link (passwordless — there is no password to set). The sender is no-reply@mayorshall.com; if it does not appear within a minute, please check the spam folder. No invitation, approval or payment is required.
    3. Click the link. You are signed in, and the extension connects to your account automatically — there is nothing to copy, paste or configure.
    4. In the web app or in the extension popup, create a matter (any title, e.g. "Test matter").
    5. Visit any web page, select a sentence, and a popover appears. Click any category chip — Fact, Date, Issue, Evidence, Case law, etc. The passage is saved as a card, with the page URL and title as its source.
    6. Verify: click the extension's toolbar icon to see the clip under "Recent clips", or click "View all" to see it on the matter board in the web app.
    7. The toolbar popup also lets you type a free-text note and save it to the same matter, and the switch there turns clipping on/off.

    NOTES

    - Broad host permissions are required because users clip from arbitrary sites (court and judgment databases, government portals, news, PDFs opened in the browser), which cannot be listed in advance. Page content is read only at the moment the user selects text and clicks to save.
    - No remote code: all JavaScript ships in the package. Network calls are JSON API requests only.
    - Dependency: the hosted May or Shall web app above, operated by the same developer. Users may instead point the extension at their own self-hosted server via Options.

# Privacy practices tab — answers for the developer dashboard

## Single purpose description

Saves text the user selects on a web page as a categorised, source-linked note ("card")
in the user's own self-hosted May or Shall litigation workspace.

## Permission justifications

**Host permissions (all sites) + content script on all sites**
The extension is a clipper for litigation research: users save selected passages from
arbitrary websites (court websites, legal databases, news). The selection popover must
therefore be available on any page the user reads. Additionally, the extension's API
calls go to a user-configured, self-hosted server whose address is not known in advance
(localhost, a firm intranet host, or any private domain), so the backend cannot be
enumerated in the manifest. Page content is read only at the moment the user makes a
selection and explicitly clicks a save button; nothing is read or transmitted passively.

**storage**
Stores the user's own configuration: the address of their self-hosted server, the API
token that server issued to them, and their currently selected matter.

**activeTab**
When the user saves a rough note from the toolbar popup, the current tab's URL and title
are attached as the note's source citation. Read only on explicit user action.

## Remote code

No. All code ships in the package; nothing is loaded or evaluated from remote sources.

## Data usage disclosures (check these boxes)

- **Website content** (text the user selects; page URL/title): collected — sent solely to
  the user's own configured server. Not sold. Not shared with third parties. Not used for
  purposes unrelated to the single purpose. Not used for creditworthiness/lending.
- **Authentication information** (API token for the user's own server): stored locally in
  chrome.storage; sent only to that server.
- Everything else (location, web history, user activity/keystroke logging, health,
  financial info, personal communications, PII): **not collected**.

## Certification

Tick all three "I certify" statements — they are true for this extension:
1. Not sold to third parties, outside approved use cases ✓
2. Not used/transferred for purposes unrelated to the single purpose ✓
3. Not used/transferred to determine creditworthiness or for lending ✓

## Privacy policy URL

https://github.com/daddu-boy/may-or-shall/blob/main/extension/PRIVACY.md

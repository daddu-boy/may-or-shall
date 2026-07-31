import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — May or Shall",
  description:
    "How May or Shall handles your data across the web app, the Word add-in and the Chrome web clipper.",
};

/**
 * Public privacy policy for the whole May or Shall service. Linked from the
 * AppSource and store listings, so it must name the products by name, describe
 * the service (not just the marketing site), and never 404.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-slate-800">
      <h1 className="text-2xl font-semibold mb-1">May or Shall — Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: 29 July 2026</p>

      <p className="mb-6">
        This policy covers the <b>May or Shall</b> service and all of its parts: the May or
        Shall web application, the <b>May or Shall</b> Microsoft Word add-in, and the{" "}
        <b>May or Shall — Web Clipper</b> browser extension. May or Shall is a litigation
        workspace: it stores the passages you save from your reading (&ldquo;cards&rdquo;)
        against a matter, and lets you place them into the document you are drafting.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Who provides the service</h2>
      <p className="mb-6">
        May or Shall is operated by Sidharth Kapoor (India). Contact:{" "}
        <a className="text-indigo-600" href="mailto:sdhkapr22@gmail.com">
          sdhkapr22@gmail.com
        </a>
        .
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">What we collect</h2>
      <ul className="list-disc pl-5 space-y-2 mb-6">
        <li>
          <b>Your email address.</b> Accounts are identified by email. Signing in sends a
          one-click link to that address; there is no password.
        </li>
        <li>
          <b>The content you choose to save.</b> Passages you select and save, notes you
          type, the category you assign, and — where the passage came from a web page — that
          page&rsquo;s URL and title, kept as the citation. Documents (such as PDFs) you
          upload to a matter, and anything you write in the workspace.
        </li>
        <li>
          <b>Access tokens.</b> The Word add-in and the browser extension authenticate with
          a token issued to your account. You can revoke these at any time under Settings
          &rarr; API tokens.
        </li>
      </ul>
      <p className="mb-6">
        Nothing is collected passively. The Word add-in reads your document only when you
        ask it to insert cards, and the browser extension reads a page only at the moment
        you select text and choose to save it. Neither records your browsing, and the
        service contains no analytics, advertising or tracking.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">How it is used</h2>
      <p className="mb-6">
        Your data is used solely to provide the service to you: storing your matters and
        cards, showing them back to you, and placing them into your documents. It is{" "}
        <b>never sold</b>, never shared with third parties for their own purposes, never
        used for advertising or profiling, and never used to assess creditworthiness or for
        lending. It is not used to train machine-learning models.
      </p>
      <p className="mb-6">
        If you use the optional AI drafting features, the relevant text from your matter is
        sent to Anthropic&rsquo;s API to generate the draft you asked for, and is not used
        by them to train models. AI features can be switched off per matter.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Where it is stored</h2>
      <p className="mb-6">
        Data is held in the service&rsquo;s hosted database and file storage (Railway), and
        sign-in emails are delivered via Resend. These providers process data only to run
        the service. The source code is published so you can inspect how your data is
        handled; it is not licensed for you to run your own copy.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Retention and deletion</h2>
      <p className="mb-6">
        Your content is kept until you delete it. You can delete individual cards, or an
        entire matter, from the web app at any time. To delete your account and everything
        in it, email{" "}
        <a className="text-indigo-600" href="mailto:sdhkapr22@gmail.com">
          sdhkapr22@gmail.com
        </a>{" "}
        and it will be removed. Uninstalling the add-in or the extension removes their
        stored settings from your device.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Your data is yours</h2>
      <p className="mb-6">
        You may request a copy of your data, or its correction or deletion, at the address
        above. Matters are private to the account that created them; no other user of the
        service can see them.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Changes</h2>
      <p>
        If this policy changes materially, the date above will be updated and the change
        noted in the service&rsquo;s public repository at{" "}
        <a className="text-indigo-600" href="https://github.com/daddu-boy/may-or-shall">
          github.com/daddu-boy/may-or-shall
        </a>
        .
      </p>
    </main>
  );
}

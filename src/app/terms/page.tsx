import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — May or Shall",
  description:
    "The terms on which May or Shall, its browser extension, Word add-in and MCP connector are provided.",
};

/**
 * Public terms of service. Required by the OpenAI plugin directory alongside
 * the privacy policy, and linked from the store listings, so it must never
 * 404 and must describe the whole service rather than the marketing site.
 */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-slate-800">
      <h1 className="text-2xl font-semibold mb-1">May or Shall — Terms of Service</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: 21 August 2026</p>

      <p className="mb-6">
        These terms govern your use of <b>May or Shall</b>: the web application at
        app.mayorshall.com, the <b>May or Shall — Web Clipper</b> browser extension, the
        Microsoft Word add-in, and the connector that lets an AI client read your matters.
        By using any of them you agree to these terms. If you do not agree, please do not
        use the service.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Who provides it</h2>
      <p className="mb-6">
        May or Shall is operated by Sidharth Kapoor, an individual based in India. Contact:{" "}
        <a className="text-indigo-600" href="mailto:sdhkapr22@gmail.com">
          sdhkapr22@gmail.com
        </a>
        .
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">It is not legal advice</h2>
      <p className="mb-6">
        May or Shall is a tool for organising your own work. It is not a law firm, it does
        not practise law, and using it creates no advocate-client or solicitor-client
        relationship with its operator. Nothing it drafts, extracts, assembles or flags is
        advice. <b>Everything it produces must be checked by the lawyer responsible for the
        matter before it is used or filed.</b> Features such as the deemed-admission review
        are aids to your own attention, not a substitute for it, and no warranty is given
        that they catch every instance.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Your account</h2>
      <p className="mb-6">
        Accounts are identified by email address and signed in with a link sent to that
        address. You are responsible for the security of that mailbox and for anything done
        through your account. Tell us promptly if you believe it has been used without your
        authority.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Your content stays yours</h2>
      <p className="mb-6">
        You keep all rights in the documents, passages, notes and drafts you put into May or
        Shall. You grant its operator only the narrow permission needed to run the service
        for you: to store your content, process it, and show it back to you. It is not sold,
        not shared with third parties for their own purposes, and not used to train
        machine-learning models. See the{" "}
        <a className="text-indigo-600" href="/privacy">
          privacy policy
        </a>{" "}
        for detail.
      </p>
      <p className="mb-6">
        You are responsible for having the right to upload what you upload, and for
        complying with your own professional obligations of confidentiality and privilege
        when you do.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Connecting AI tools</h2>
      <p className="mb-6">
        You may connect an external AI client to your matters. When you do, the material
        that client requests <b>leaves May or Shall</b> and is handled by whoever operates
        that client, under your own account and their terms, not ours. That is your decision
        to make and your responsibility to assess, including whether it is appropriate for
        privileged material. Connect only what you would be willing to show a client&rsquo;s
        file to. You can disconnect any client at any time under Settings, and revoke API
        tokens there too.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Acceptable use</h2>
      <p className="mb-6">
        Do not use May or Shall to break the law, to infringe anyone&rsquo;s rights, to
        upload material you have no right to, to attack or overload the service, to
        circumvent its access controls, or to reach another user&rsquo;s data. Automated
        access is fine through the documented API and connector; scraping or load that
        threatens the service for others is not.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">The service is free, and provided as is</h2>
      <p className="mb-6">
        May or Shall is currently offered free of charge. There is no uptime commitment, no
        support commitment, and no guarantee that any feature will continue to exist. It may
        change, be interrupted, or be discontinued. Reasonable notice will be given before a
        planned discontinuation so you can export your work, but you should keep your own
        copies of anything you rely on. <b>Do not treat May or Shall as the only place a
        document exists.</b>
      </p>
      <p className="mb-6">
        To the fullest extent permitted by law, the service is provided without warranties
        of any kind, and its operator is not liable for indirect or consequential loss, or
        for loss of profit, business, data or goodwill, arising from its use. Nothing in
        these terms limits liability for fraud, or for anything else that cannot lawfully be
        limited.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Ending it</h2>
      <p className="mb-6">
        You may stop using May or Shall at any time and delete individual cards, a whole
        matter, or your account and everything in it. Access may be suspended or ended if
        these terms are breached in a way that harms the service or another user.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">The software, and the name</h2>
      <p className="mb-6">
        May or Shall is free software under the{" "}
        <a
          className="text-indigo-600"
          href="https://www.gnu.org/licenses/agpl-3.0.html"
          target="_blank"
          rel="noopener"
        >
          GNU Affero General Public Licence v3
        </a>
        , and you are welcome to read it, modify it and run your own copy. Those terms cover
        the source code. They are not these terms, which cover the hosted service, and they
        do not grant rights in the name &ldquo;May or Shall&rdquo;, the MS monogram, or the
        other brand assets. If you run your own copy, please give it a different name. See{" "}
        <a
          className="text-indigo-600"
          href="https://github.com/daddu-boy/may-or-shall"
          target="_blank"
          rel="noopener"
        >
          the repository
        </a>
        .
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Changes</h2>
      <p className="mb-6">
        These terms may be updated. The date at the top will change, and material changes
        will be notified by email to the address on your account. Continuing to use the
        service after that means you accept the revised terms.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Governing law</h2>
      <p className="mb-6">
        These terms are governed by the laws of India, and the courts at New Delhi have
        exclusive jurisdiction over any dispute arising out of them.
      </p>

      <p className="mt-10 text-sm text-slate-500">
        Questions about these terms:{" "}
        <a className="text-indigo-600" href="mailto:sdhkapr22@gmail.com">
          sdhkapr22@gmail.com
        </a>
        .
      </p>
    </main>
  );
}

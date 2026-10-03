import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import Film from "./Film";
import "./welcome.css";

export const metadata: Metadata = {
  title: "May or Shall: highlight while you read, then draft in ChatGPT",
  description:
    "Save the lines that matter as you read, on any website or PDF, and let ChatGPT draft from what you marked, citing each highlight.",
};

const CHROME_STORE = "https://chromewebstore.google.com/detail/jcdaggdinfgihjbjgmpieohgehalpfac";

/**
 * The front door, for anyone who arrives without knowing what May or Shall is.
 * Signed out visitors land here from "/"; signed in people reach it from the
 * May or Shall name in the app, and get a way back to their matters instead
 * of a sign in button.
 */
export default async function Welcome() {
  const session = await auth();
  const signedIn = Boolean(session?.user);
  const enter = signedIn
    ? { href: "/", label: "Open my matters" }
    : { href: "/signin", label: "Sign in" };

  return (
    <main className="lp">
      <header className="lp-nav">
        <div className="lp-nav-in">
          <Link href="/welcome" className="lp-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/icon.png" alt="" />
            May or Shall
          </Link>
          <nav className="lp-nav-links">
            <a className="lp-hide-sm" href="#idea">The idea</a>
            <a className="lp-hide-sm" href="#how">How it works</a>
            <a className="lp-hide-sm" href="#next">Coming next</a>
            <a href={CHROME_STORE} target="_blank" rel="noreferrer">Add to Chrome</a>
            <Link className="lp-strong" href={enter.href}>{enter.label}</Link>
          </nav>
        </div>
      </header>

      <div className="lp-tiles">
        {/* the film */}
        <section className="lp-tile lp-light">
          <p className="lp-eyebrow">For lawyers who read before they draft</p>
          <h1 className="lp-h1 lp-display">May or Shall</h1>
          <p className="lp-sub lp-display">Save the lines that matter. Then let ChatGPT draft from them.</p>
          <div className="lp-ctas">
            <a className="lp-btn lp-btn-fill" href={CHROME_STORE} target="_blank" rel="noreferrer">
              Add to Chrome
            </a>
            <Link className="lp-btn lp-btn-line" href={enter.href}>
              {enter.label}
            </Link>
          </div>
          {!signedIn && <p className="lp-fine">Sign in with your email address. A sample case is waiting in your account.</p>}
          <Film />
        </section>

        {/* the idea */}
        <section id="idea" className="lp-tile lp-dark">
          <p className="lp-eyebrow">The idea</p>
          <h2 className="lp-h2 lp-display">The human in the loop. At the start.</h2>
          <p className="lp-sub lp-display">Not only at the end.</p>
          <p className="lp-body">
            Lawyers do not trust AI to decide what matters in a document, because it misses things.
            But a good lawyer reads every important document anyway, and marks it. That marking is
            the judgment the AI should be working from.
          </p>
          <div className="lp-compare">
            <div>
              <p className="lp-label">AI tools today</p>
              <h4>The AI decides what matters. You check it at the end.</h4>
              <p>
                You upload the documents, the model picks what it thinks is relevant and drafts, and
                then you go back through it hoping nothing was missed.
              </p>
              <div className="lp-chain">
                <span>AI reads</span>›<span>AI drafts</span>›<b>You check</b>
              </div>
            </div>
            <div>
              <p className="lp-label lp-label-new">With May or Shall</p>
              <h4>You decide what matters. The AI drafts from it.</h4>
              <p>
                You read and highlight as you always do. ChatGPT gets the whole document for context,
                but your highlights are flagged, so it leans on them and cites each one.
              </p>
              <div className="lp-chain">
                <b>You read and mark</b>›<span>AI drafts from your marks</span>›<span>Every line cited</span>
              </div>
            </div>
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="lp-tile lp-light">
          <p className="lp-eyebrow">How it works</p>
          <h2 className="lp-h2 lp-display">Highlight. Save. Ask ChatGPT.</h2>
          <p className="lp-sub lp-display">The drafting happens while you read.</p>
          <div className="lp-steps">
            <div className="lp-step">
              <div className="lp-num">1</div>
              <h4>Select a line</h4>
              <p>On any website, such as a judgment or an order, or in a PDF opened in May or Shall.</p>
              <div className="lp-mock">
                12. <mark>A landlord cannot keep the security deposit without proof of damage.</mark>
              </div>
            </div>
            <div className="lp-step">
              <div className="lp-num">2</div>
              <h4>Save it</h4>
              <p>Add a note if you like. It is kept with its page and paragraph, under the case it belongs to.</p>
              <div className="lp-mock">
                A landlord cannot keep the security deposit without proof of damage.
                <br />
                <span className="lp-cite">Mehta v. Rao, para 12</span>
                {"  "}
                <span className="lp-saved">✓ Saved</span>
              </div>
            </div>
            <div className="lp-step">
              <div className="lp-num">3</div>
              <h4>Ask ChatGPT</h4>
              <p>In ChatGPT, open Apps and add May or Shall. Ask it to search your highlights or draft from them.</p>
              <div className="lp-mock">
                Under the lease, the deposit had to be refunded within 30 days.
                <br />
                <span className="lp-cite">Lease Agreement, p.3</span>
              </div>
            </div>
          </div>
        </section>

        {/* two tiles side by side */}
        <div className="lp-row">
          <section className="lp-tile lp-dark">
            <h3 className="lp-h3 lp-display">Inside ChatGPT.</h3>
            <p className="lp-sub-sm lp-display">
              Ask it to search your highlights or draft from them. It reads the whole document, and
              leans on what you marked.
            </p>
            <div className="lp-ctas">
              <a className="lp-link" href="#how">See how it works</a>
            </div>
          </section>
          <section className="lp-tile lp-light">
            <h3 className="lp-h3 lp-display">Web pages and PDFs.</h3>
            <p className="lp-sub-sm lp-display">
              Clip from any website with the Chrome extension, or upload a PDF and highlight it in
              May or Shall.
            </p>
            <div className="lp-ctas">
              <a className="lp-link" href={CHROME_STORE} target="_blank" rel="noreferrer">Add to Chrome</a>
            </div>
          </section>
        </div>

        {/* what is next */}
        <section id="next" className="lp-tile lp-light">
          <p className="lp-eyebrow">Coming next</p>
          <h2 className="lp-h2 lp-display">The same highlights, turned into the work.</h2>
          <p className="lp-sub lp-display">So what you mark while reading becomes the first draft.</p>
          <div className="lp-next">
            <div>
              <h4>List of dates</h4>
              <p>Every date you mark, in order, with the page it came from.</p>
            </div>
            <div>
              <h4>Chronologies</h4>
              <p>The story of the matter, assembled from what you highlighted.</p>
            </div>
            <div>
              <h4>Briefing notes</h4>
              <p>A note for counsel, drafted from your highlights and citing each one.</p>
            </div>
          </div>
          <span className="lp-wip">Work in progress</span>
        </section>

        {/* the close */}
        <section className="lp-tile lp-dark">
          <h2 className="lp-h2 lp-display">Read as you always do.</h2>
          <p className="lp-sub lp-display">Let the drafting keep up.</p>
          <div className="lp-ctas">
            <a className="lp-btn lp-btn-fill" href={CHROME_STORE} target="_blank" rel="noreferrer">
              Add to Chrome
            </a>
            <Link className="lp-btn lp-btn-line" href={enter.href}>
              {enter.label}
            </Link>
          </div>
        </section>
      </div>

      <footer className="lp-foot">
        <div className="lp-foot-in">
          <p>May or Shall is free software under the GNU AGPL v3.</p>
          <nav>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="https://github.com/daddu-boy/may-or-shall" target="_blank" rel="noreferrer">Source code</a>
            <a href="mailto:sdhkapr22@gmail.com">Contact</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}

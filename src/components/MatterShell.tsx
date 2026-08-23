"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/clientTypes";
import { CARD_TYPE_LABEL, type CardTypeValue } from "@/lib/labels";
import SectionTip from "@/components/SectionTip";

interface SearchResults {
  documents: { documentId: string; filename: string; page: number; snippet: string }[];
  cards: {
    id: string;
    cardType: CardTypeValue;
    body: string;
    documentId: string | null;
    filename: string | null;
    page: number | null;
    para: string | null;
  }[];
}

/**
 * Two groups, because the list had grown into eight unlabelled items and read
 * as one undifferentiated pile. The first is the case file as it comes in and
 * how you read it; the second is what you produce from it. Editable rows sits
 * last because it is the most specialised.
 *
 * Every item carries two explanations. The hint is one line, always visible,
 * so nobody has to guess what a screen is for. The tip is longer and appears
 * once, the first time you open that screen, and then never again.
 */
interface NavItem {
  label: string;
  slug: string;
  hint: string;
  tip: { title: string; body: string };
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Case file",
    items: [
      {
        label: "Upload",
        slug: "documents",
        hint: "Put the case bundle in as PDFs",
        tip: {
          title: "Start here",
          body: "Drag the PDFs of your bundle into this screen. Open one and it becomes a reader: select any passage and it saves as a card that remembers its document, page and paragraph.",
        },
      },
      {
        label: "Workspace",
        slug: "compare",
        hint: "Read two documents at once",
        tip: {
          title: "Two documents, one view",
          body: "Choose a document for each side, then link a passage in one to a passage in the other and say how they relate. Click any card in the rails to jump straight to the line it came from.",
        },
      },
      {
        label: "Cards",
        slug: "cards",
        hint: "Every passage you have marked",
        tip: {
          title: "Everything you marked lands here",
          body: "Cards are grouped by what they are. Filter them, tag them by issue, reorder them, and export the whole set to Word or PDF with every citation attached.",
        },
      },
    ],
  },
  {
    heading: "Drafting",
    items: [
      {
        label: "Chronology",
        slug: "chronology",
        hint: "Your Date cards as a List of Dates",
        tip: {
          title: "The list builds itself",
          body: "Date cards arrive here on their own. Add rows by hand, take any row out of the filing, and export it in court format as a Word document.",
        },
      },
      {
        label: "Native Drafting",
        slug: "drafts",
        hint: "Write with your cards beside you",
        tip: {
          title: "Draft from what you marked",
          body: "Write here with the card base to hand, or generate a first draft from your cards. Every factual sentence carries its citation, and regenerating makes a new version rather than overwriting.",
        },
      },
      {
        label: "Compilation",
        slug: "compilation",
        hint: "One PDF of the pages you cite",
        tip: {
          title: "The convenience compilation",
          body: "Pick cards or issues and get a single PDF of exactly the pages they cite, with an index page, continuous pagination and a bookmark for each document.",
        },
      },
      {
        label: "Annexures",
        slug: "annexures",
        hint: "Label documents and renumber references",
        tip: {
          title: "Reorder without retyping",
          body: "This is the registry that maps each document to its annexure label. Reorder it and every live reference in your drafts renumbers itself. Exports an Index of Annexures.",
        },
      },
      {
        label: "Editable rows",
        slug: "traverse",
        hint: "Answer a plaint paragraph by paragraph",
        tip: {
          title: "One row for every paragraph",
          body: "Designate the plaint and it splits into a row per paragraph for the written statement. Review mode flags every paragraph that still lacks a specific denial, which is the risk under Order VIII Rule 5.",
        },
      },
    ],
  },
];

const UPCOMING: string[] = [];

export default function MatterShell({
  matterId,
  title,
  subtitle,
  children,
}: {
  matterId: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  /** the navigation folds away, because two documents side by side need the width */
  const [navOpen, setNavOpen] = useState(true);
  useEffect(() => {
    setNavOpen(localStorage.getItem("mos.nav.collapsed") !== "1");
  }, []);
  const toggleNav = () => {
    setNavOpen((v) => {
      localStorage.setItem("mos.nav.collapsed", v ? "1" : "0");
      return !v;
    });
  };
  /** groups fold away, because eight items with descriptions is a tall rail */
  const [collapsed, setCollapsed] = useState<string[]>([]);
  useEffect(() => {
    try {
      setCollapsed(JSON.parse(localStorage.getItem("mos.nav.groups") || "[]"));
    } catch {
      /* a corrupt value just means everything stays open */
    }
  }, []);
  const toggleGroup = (heading: string) =>
    setCollapsed((prev) => {
      const next = prev.includes(heading)
        ? prev.filter((h) => h !== heading)
        : [...prev, heading];
      localStorage.setItem("mos.nav.groups", JSON.stringify(next));
      return next;
    });

  /**
   * Which explanations this account has already dismissed, from the server.
   * Null until it arrives, so a bubble never flashes up and vanish again for
   * someone who dismissed it months ago on another machine.
   */
  const [tipsSeen, setTipsSeen] = useState<string[] | null>(null);
  const tipsLoaded = useRef(false);
  useEffect(() => {
    if (tipsLoaded.current) return;
    tipsLoaded.current = true;
    api<{ seen: string[] }>("/api/me/tips")
      .then(({ seen }) => {
        /*
         * These used to live in browser storage. Anything dismissed there is
         * carried up to the account once, so moving the record does not make
         * every bubble reappear for people who already read them.
         */
        const stale = NAV_GROUPS.flatMap((g) => g.items)
          .map((i) => i.slug)
          .filter((slug) => !seen.includes(slug) && localStorage.getItem(`mos.tip.${slug}`) === "1");
        if (stale.length === 0) return setTipsSeen(seen);
        setTipsSeen([...seen, ...stale]);
        Promise.all(
          stale.map((id) =>
            api("/api/me/tips", { method: "POST", body: JSON.stringify({ id }) }).catch(() => {})
          )
        ).then(() => stale.forEach((slug) => localStorage.removeItem(`mos.tip.${slug}`)));
      })
      .catch(() => setTipsSeen([]));
  }, []);

  /** set by the information button: show this screen's bubble again on demand */
  const [asked, setAsked] = useState<string | null>(null);
  useEffect(() => {
    setAsked(null);
  }, [pathname]);

  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    debounce.current = setTimeout(async () => {
      setResults(await api<SearchResults>(`/api/matters/${matterId}/search?q=${encodeURIComponent(q)}`));
      setOpen(true);
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [q, matterId]);

  const current = NAV_GROUPS.flatMap((g) => g.items).find((i) =>
    pathname.startsWith(`/matters/${matterId}/${i.slug}`)
  );

  /**
   * Which explanation is on screen: the one you asked for by pressing an
   * item's information button, or otherwise this screen's own, if this account
   * has never dismissed it.
   */
  const tipFor =
    tipsSeen === null
      ? undefined
      : asked
        ? NAV_GROUPS.flatMap((g) => g.items).find((i) => i.slug === asked)
        : current && !tipsSeen.includes(current.slug)
          ? current
          : undefined;

  const dismissTip = () => {
    setAsked(null);
    if (!tipFor || !tipsSeen || tipsSeen.includes(tipFor.slug)) return;
    // dismissing one means it has been read, however it came to be on screen
    setTipsSeen([...tipsSeen, tipFor.slug]);
    // the record is the account's, so a second device does not ask again
    api("/api/me/tips", { method: "POST", body: JSON.stringify({ id: tipFor.slug }) }).catch(
      () => {}
    );
  };

  const go = (url: string) => {
    setOpen(false);
    setQ("");
    router.push(url);
  };

  return (
    <div className="flex h-screen" style={{ background: "var(--bg)" }}>
      <aside
        className={`night shrink-0 flex flex-col overflow-hidden transition-[width] duration-200 ${
          navOpen ? "w-64" : "w-0"
        }`}
        style={{
          background:
            "radial-gradient(30rem 20rem at 0% 0%, rgba(139,135,255,0.18), transparent 60%), linear-gradient(180deg, #121217 0%, #0b0b0f 100%)",
        }}
      >
        <div className="px-5 pt-5 pb-5">
          <Link
            href="/"
            className="text-[11.5px] transition-colors hover:text-[var(--text)]"
            style={{ color: "var(--text-tertiary)" }}
          >
            ← All matters
          </Link>
          <h2 className="mt-3 text-[16px] font-semibold leading-snug">{title}</h2>
          {subtitle && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </p>
          )}
        </div>

        {/*
         * Each group sits in its own well under a ruled heading. The label
         * alone was not enough: two grey words above eight identical rows read
         * as one list, so the group now has a visible container.
         */}
        <nav className="px-3 pb-5 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((group) => {
            const open = !collapsed.includes(group.heading);
            const holdsCurrent = group.items.some((i) => i.slug === current?.slug);
            return (
              <div key={group.heading}>
                <button
                  onClick={() => toggleGroup(group.heading)}
                  className="rail-heading mb-1.5"
                  aria-expanded={open}
                >
                  <span>{group.heading}</span>
                  <span className="rail-count">{group.items.length}</span>
                  <span className="rail-rule" />
                  {!open && holdsCurrent && <span className="rail-dot" />}
                  <span className="rail-chevron" data-open={open}>
                    ▾
                  </span>
                </button>
                {open && (
                  <div className="rail-well space-y-0.5">
                    {group.items.map((item) => {
                      const href = `/matters/${matterId}/${item.slug}`;
                      const active = pathname.startsWith(href);
                      return (
                        <div key={item.slug} className="relative">
                          <Link
                            href={href}
                            data-tour={`nav-${item.slug}`}
                            data-active={active}
                            className="nav-item px-3 py-2 pr-9 text-[13.5px] font-medium"
                          >
                            {item.label}
                            <span className="nav-hint">{item.hint}</span>
                          </Link>
                          <button
                            onClick={() => setAsked(item.slug)}
                            data-active={active}
                            className="nav-i"
                            aria-label={`What ${item.label} is for`}
                            title={`What ${item.label} is for`}
                          >
                            i
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {UPCOMING.map((label) => (
            <span
              key={label}
              className="block px-3 py-2 text-[13.5px] cursor-not-allowed"
              style={{ color: "var(--text-tertiary)", opacity: 0.5 }}
            >
              {label}
            </span>
          ))}
        </nav>

      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="night h-14 shrink-0 flex items-center px-4 relative"
          style={{ background: "linear-gradient(180deg, #121217 0%, #0e0e13 100%)" }}
        >
          <button
            onClick={toggleNav}
            title={navOpen ? "Hide the sidebar" : "Show the sidebar"}
            className="chip mr-3 shrink-0 px-2.5 py-1.5 text-[13px]"
          >
            {navOpen ? "\u00ab" : "\u00bb"}
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results && setOpen(true)}
            placeholder="Search documents and cards in this matter…"
            className="field w-[26rem] px-3.5 py-2 text-[13.5px]"
            data-testid="matter-search"
          />
          {open && results && (
            <div
              className="night glass absolute top-[3.25rem] left-4 w-[32rem] max-h-96 overflow-auto z-50 text-sm"
              onMouseLeave={() => setOpen(false)}
            >
              {results.documents.length === 0 && results.cards.length === 0 && (
                <p className="p-3" style={{ color: "var(--text-tertiary)" }}>
                  No results.
                </p>
              )}
              {results.documents.length > 0 && (
                <div className="p-2">
                  <p className="rail-heading px-2 py-1.5">Documents</p>
                  {results.documents.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => go(`/matters/${matterId}/documents/${d.documentId}?page=${d.page}`)}
                      className="nav-item w-full text-left px-2.5 py-2"
                    >
                      <span className="font-medium" style={{ color: "var(--text)" }}>
                        {d.filename}
                      </span>
                      <span style={{ color: "var(--text-tertiary)" }}> · p.{d.page}</span>
                      <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                        {d.snippet}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {results.cards.length > 0 && (
                <div className="p-2" style={{ borderTop: "1px solid var(--hairline)" }}>
                  <p className="rail-heading px-2 py-1.5">Cards</p>
                  {results.cards.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => go(`/matters/${matterId}/cards?card=${c.id}`)}
                      className="nav-item w-full text-left px-2.5 py-2"
                    >
                      <span
                        className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {CARD_TYPE_LABEL[c.cardType]}
                      </span>
                      <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                        {c.body}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>
        <main className="flex-1 min-h-0 overflow-auto">{children}</main>
      </div>

      {tipFor && (
        <SectionTip
          key={tipFor.slug}
          title={tipFor.tip.title}
          body={tipFor.tip.body}
          anchor={`[data-tour="nav-${tipFor.slug}"]`}
          onDismiss={dismissTip}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/clientTypes";
import { CARD_TYPE_LABEL, type CardTypeValue } from "@/lib/labels";
import Coachmarks from "@/components/Coachmarks";

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
 */
const NAV_GROUPS = [
  {
    heading: "Case file",
    items: [
      { label: "Upload", slug: "documents" },
      { label: "Workspace", slug: "compare" },
      { label: "Cards", slug: "cards" },
    ],
  },
  {
    heading: "Drafting",
    items: [
      { label: "Chronology", slug: "chronology" },
      { label: "Native Drafting", slug: "drafts" },
      { label: "Compilation", slug: "compilation" },
      { label: "Annexures", slug: "annexures" },
      { label: "Editable rows", slug: "traverse" },
    ],
  },
] as const;

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
        <nav className="px-3 pb-4 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="rail-heading px-1.5 pb-2">{group.heading}</p>
              <div className="rail-well space-y-0.5">
                {group.items.map((item) => {
                  const href = `/matters/${matterId}/${item.slug}`;
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={item.slug}
                      href={href}
                      data-tour={`nav-${item.slug}`}
                      data-active={active}
                      className="nav-item px-3 py-2 text-[13.5px] font-medium"
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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
        <Coachmarks
          id="workspace-v1"
          steps={[
            {
              anchor: "nav-documents",
              title: "Documents: the case bundle",
              body: "Drag PDFs in here. Open one and it becomes a reader: select any passage and it turns into a card that keeps its page and paragraph.",
            },
            {
              anchor: "nav-cards",
              title: "Cards: everything you marked",
              body: "Every highlight lands here, grouped by what it is. From this board you can download the whole set as Word or PDF, citations attached.",
            },
            {
              anchor: "nav-chronology",
              title: "The filing builds itself",
              body: "Date cards become a List of Dates. Traverse answers a plaint paragraph by paragraph. Compilation and Annexures assemble what you file.",
            },
          ]}
        />
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
    </div>
  );
}

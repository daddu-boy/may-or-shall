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
        className={`shrink-0 flex flex-col overflow-hidden transition-[width] duration-200 ${
          navOpen ? "w-60" : "w-0"
        }`}
        style={{ borderRight: "1px solid var(--hairline)", background: "var(--surface)" }}
      >
        <div className="px-5 pt-5 pb-4">
          <Link
            href="/"
            className="text-xs transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            ← All matters
          </Link>
          <h2 className="mt-3 text-[15px] font-semibold leading-snug">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </p>
          )}
        </div>
        <nav className="px-3 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading}>
              <p
                className="px-3 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {group.heading}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const href = `/matters/${matterId}/${item.slug}`;
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={item.slug}
                      href={href}
                      data-tour={`nav-${item.slug}`}
                      className="block rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors"
                      style={
                        active
                          ? { background: "var(--text)", color: "var(--bg)" }
                          : { color: "var(--text-secondary)" }
                      }
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
          className="h-14 shrink-0 flex items-center px-5 relative"
          style={{ borderBottom: "1px solid var(--hairline)", background: "var(--surface)" }}
        >
          <button
            onClick={toggleNav}
            title={navOpen ? "Hide the sidebar" : "Show the sidebar"}
            className="mr-3 shrink-0 rounded-md px-2 py-1.5 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {navOpen ? "\u00ab" : "\u00bb"}
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results && setOpen(true)}
            placeholder="Search documents and cards in this matter…"
            className="field w-[26rem] px-3.5 py-2 text-[13.5px]"
            style={{ background: "var(--surface-sunken)" }}
            data-testid="matter-search"
          />
          {open && results && (
            <div
              className="surface absolute top-[3.25rem] left-5 w-[32rem] max-h-96 overflow-auto z-50 text-sm"
              onMouseLeave={() => setOpen(false)}
            >
              {results.documents.length === 0 && results.cards.length === 0 && (
                <p className="p-3 text-slate-400">No results.</p>
              )}
              {results.documents.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase">Documents</p>
                  {results.documents.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => go(`/matters/${matterId}/documents/${d.documentId}?page=${d.page}`)}
                      className="block w-full text-left px-2 py-1.5 rounded hover:bg-slate-50"
                    >
                      <span className="font-medium">{d.filename}</span>
                      <span className="text-slate-400"> · p.{d.page}</span>
                      <p className="text-xs text-slate-500 truncate">{d.snippet}</p>
                    </button>
                  ))}
                </div>
              )}
              {results.cards.length > 0 && (
                <div className="p-2 border-t border-slate-100">
                  <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase">Cards</p>
                  {results.cards.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => go(`/matters/${matterId}/cards?card=${c.id}`)}
                      className="block w-full text-left px-2 py-1.5 rounded hover:bg-slate-50"
                    >
                      <span className="text-xs font-medium text-slate-400">
                        {CARD_TYPE_LABEL[c.cardType]}
                      </span>
                      <p className="text-xs text-slate-600 truncate">{c.body}</p>
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

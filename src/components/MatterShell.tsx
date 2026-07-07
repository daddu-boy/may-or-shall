"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/clientTypes";
import { CARD_TYPE_LABEL, type CardTypeValue } from "@/lib/labels";

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

const NAV = [
  { label: "Documents", slug: "documents" },
  { label: "Cards", slug: "cards" },
  { label: "Chronology", slug: "chronology" },
  { label: "Traverse", slug: "traverse" },
  { label: "Drafts", slug: "drafts" },
  { label: "Compilation", slug: "compilation" },
  { label: "Annexures", slug: "annexures" },
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
    <div className="flex h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">
            ← All matters
          </Link>
          <h2 className="font-semibold text-sm mt-2 leading-snug">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <nav className="p-2 space-y-0.5">
          {NAV.map((item) => {
            const href = `/matters/${matterId}/${item.slug}`;
            const active = pathname.startsWith(href);
            return (
              <Link
                key={item.slug}
                href={href}
                className={`block rounded-md px-3 py-1.5 text-sm ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {UPCOMING.map((label) => (
            <span
              key={label}
              className="block px-3 py-1.5 text-sm text-slate-300 cursor-not-allowed"
              title="Coming in a later phase"
            >
              {label}
            </span>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 shrink-0 border-b border-slate-200 bg-white flex items-center px-4 relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results && setOpen(true)}
            placeholder="Search documents and cards in this matter…"
            className="w-96 border border-slate-200 rounded-md px-3 py-1.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400"
            data-testid="matter-search"
          />
          {open && results && (
            <div
              className="absolute top-11 left-4 w-[32rem] max-h-96 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl z-50 text-sm"
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

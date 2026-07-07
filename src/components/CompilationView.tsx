"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type CardDto } from "@/lib/clientTypes";

export default function CompilationView({ matterId }: { matterId: string }) {
  const [cards, setCards] = useState<CardDto[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [scope, setScope] = useState<"cited" | "full">("cited");
  const [contextPages, setContextPages] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setCards(await api<CardDto[]>(`/api/matters/${matterId}/cards`));
  }, [matterId]);

  useEffect(() => {
    load();
  }, [load]);

  const tags = useMemo(() => [...new Set(cards.flatMap((c) => c.tags))].sort(), [cards]);

  const selection = useMemo(() => {
    let selected = cards.filter((c) => c.documentId);
    if (issues.length) selected = selected.filter((c) => c.tags.some((t) => issues.includes(t)));
    if (pinnedOnly) selected = selected.filter((c) => c.pinned);
    return selected;
  }, [cards, issues, pinnedOnly]);

  const docCount = new Set(selection.map((c) => c.documentId)).size;

  const build = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/matters/${matterId}/compilation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issues, pinnedOnly, scope, contextPages }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Build failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "compilation.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-lg font-semibold mb-1">Convenience compilation</h1>
      <p className="text-xs text-slate-500 mb-5">
        Builds a single paginated PDF from the documents and pages your cards reference, with an
        index page and bookmarks per document.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">Select cards by issue</p>
          {tags.length === 0 ? (
            <p className="text-xs text-slate-400">No tagged cards — all source-linked cards will be used.</p>
          ) : (
            <div className="flex gap-1.5 flex-wrap">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setIssues((cur) =>
                      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]
                    )
                  }
                  className={`text-xs rounded-full px-2.5 py-1 border ${
                    issues.includes(tag)
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-slate-200 text-slate-500 hover:border-slate-400"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={pinnedOnly}
              onChange={(e) => setPinnedOnly(e.target.checked)}
            />
            Pinned cards only
          </label>
        </div>

        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="radio"
              checked={scope === "cited"}
              onChange={() => setScope("cited")}
            />
            Cited pages only
          </label>
          {scope === "cited" && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              ±
              <input
                type="number"
                min={0}
                max={10}
                value={contextPages}
                onChange={(e) => setContextPages(parseInt(e.target.value || "0", 10))}
                className="w-14 border border-slate-200 rounded px-1.5 py-1"
              />
              context pages
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="radio" checked={scope === "full"} onChange={() => setScope("full")} />
            Full documents
          </label>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={build}
            disabled={busy || selection.length === 0}
            className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-40"
            data-testid="build-compilation"
          >
            {busy ? "Building…" : "Build compilation (.pdf)"}
          </button>
          <span className="text-xs text-slate-400">
            {selection.length} card{selection.length === 1 ? "" : "s"} across {docCount} document
            {docCount === 1 ? "" : "s"}
          </span>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

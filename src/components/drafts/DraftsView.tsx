"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, type CardDto, type MatterDto } from "@/lib/clientTypes";

interface ArtefactSummary {
  id: string;
  artefactType: string;
  title: string;
  version: number;
  updatedAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  SENIOR_BRIEF: "Note of brief to senior counsel",
  WRITTEN_SUBMISSIONS: "Written submissions",
  JUDGE_NOTE: "Note for the judge",
  WRITTEN_STATEMENT_DRAFT: "Written statement draft",
  LIST_OF_DATES: "List of dates",
  CONVENIENCE_COMPILATION: "Convenience compilation",
};

export default function DraftsView({ matterId }: { matterId: string }) {
  const [artefacts, setArtefacts] = useState<ArtefactSummary[]>([]);
  const [matter, setMatter] = useState<MatterDto & { aiEnabled?: boolean }>();
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // new-draft form
  const [artefactType, setArtefactType] = useState("SENIOR_BRIEF");
  const [issues, setIssues] = useState<string[]>([]);
  const [mode, setMode] = useState<"generate" | "blank">("generate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [list, m, cards] = await Promise.all([
      api<ArtefactSummary[]>(`/api/matters/${matterId}/artefacts`),
      api<MatterDto & { aiEnabled: boolean }>(`/api/matters/${matterId}`),
      api<CardDto[]>(`/api/matters/${matterId}/cards`),
    ]);
    setArtefacts(list);
    setMatter(m);
    setTags([...new Set(cards.flatMap((c) => c.tags))].sort());
    setLoading(false);
  }, [matterId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const artefact = await api<{ id: string }>(`/api/matters/${matterId}/artefacts`, {
        method: "POST",
        body: JSON.stringify({ artefactType, mode, issues }),
      });
      window.location.href = `/matters/${matterId}/drafts/${artefact.id}`;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const toggleAi = async () => {
    if (!matter) return;
    await api(`/api/matters/${matterId}`, {
      method: "PATCH",
      body: JSON.stringify({ aiEnabled: !matter.aiEnabled }),
    });
    load();
  };

  const grouped = useMemo(() => {
    const map = new Map<string, ArtefactSummary[]>();
    for (const a of artefacts) {
      const key = `${a.artefactType}::${a.title}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return [...map.values()];
  }, [artefacts]);

  if (loading) return <p className="p-6 text-sm text-slate-400">Loading…</p>;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Drafts</h1>
          <p className="text-xs text-slate-500">
            AI-generated first drafts from your card base — always reviewed and edited before use.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={matter?.aiEnabled ?? true} onChange={toggleAi} />
          AI enabled for this matter
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">New draft</h2>
        <div className="flex gap-3 flex-wrap items-start">
          <select
            value={artefactType}
            onChange={(e) => setArtefactType(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm"
            data-testid="draft-type"
          >
            <option value="SENIOR_BRIEF">Note of brief to senior counsel</option>
            <option value="WRITTEN_SUBMISSIONS">Written submissions</option>
            <option value="JUDGE_NOTE">Note for the judge</option>
          </select>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "generate" | "blank")}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm"
          >
            <option value="generate">Generate with AI from cards</option>
            <option value="blank">Start blank</option>
          </select>
          <button
            onClick={create}
            disabled={busy}
            className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-40"
            data-testid="draft-create"
          >
            {busy ? "Generating… (up to 90s)" : "Create draft"}
          </button>
        </div>
        {mode === "generate" && tags.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-1">
              Issues to include (default: all cards; pinned cards are always included):
            </p>
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
          </div>
        )}
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-slate-400">No drafts yet.</p>
      ) : (
        <ul className="space-y-2">
          {grouped.map((versions) => {
            const latest = versions[0];
            return (
              <li
                key={latest.id}
                className="rounded-lg border border-slate-200 bg-white p-3 flex items-center gap-3"
                data-testid="draft-item"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/matters/${matterId}/drafts/${latest.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {latest.title}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {TYPE_LABEL[latest.artefactType] ?? latest.artefactType} · v{latest.version}
                    {versions.length > 1 && (
                      <>
                        {" · earlier: "}
                        {versions.slice(1).map((v, i) => (
                          <Link
                            key={v.id}
                            href={`/matters/${matterId}/drafts/${v.id}`}
                            className="hover:underline"
                          >
                            {i > 0 && ", "}v{v.version}
                          </Link>
                        ))}
                      </>
                    )}
                  </p>
                </div>
                <a
                  href={`/api/artefacts/${latest.id}/export`}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  Export .docx
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

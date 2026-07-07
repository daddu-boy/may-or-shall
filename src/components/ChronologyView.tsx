"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { api, type ChronologyEntryDto } from "@/lib/clientTypes";

/** Chronology / List of Dates (PRD F4): auto-populated from Date cards + manual rows. */
export default function ChronologyView({ matterId }: { matterId: string }) {
  const [entries, setEntries] = useState<ChronologyEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const load = useCallback(async () => {
    setEntries(await api<ChronologyEntryDto[]>(`/api/matters/${matterId}/chronology`));
    setLoading(false);
  }, [matterId]);

  useEffect(() => {
    load();
  }, [load]);

  const addManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newDesc.trim()) return;
    await api(`/api/matters/${matterId}/chronology`, {
      method: "POST",
      body: JSON.stringify({ eventDate: newDate, description: newDesc.trim() }),
    });
    setNewDate("");
    setNewDesc("");
    load();
  };

  const toggleInclude = async (entry: ChronologyEntryDto) => {
    await api(`/api/chronology/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({ includeInFiling: !entry.includeInFiling }),
    });
    load();
  };

  const removeManual = async (entry: ChronologyEntryDto) => {
    if (!confirm("Delete this manual entry?")) return;
    await api(`/api/chronology/${entry.id}`, { method: "DELETE" });
    load();
  };

  const duplicates = entries.filter((e) => e.flaggedDuplicate).length;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Chronology</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-populated from Date cards; add manual rows below. Toggle rows out of the filing
            before exporting.
          </p>
        </div>
        <a
          href={`/api/matters/${matterId}/exports/list-of-dates`}
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-700"
          data-testid="export-lod"
        >
          Export List of Dates (.docx)
        </a>
      </div>

      {duplicates > 0 && (
        <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {duplicates} entries look like possible duplicates (same date, similar text). They are
          marked below — consider merging before export.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <table className="w-full text-sm border-collapse" data-testid="chronology-table">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-200">
              <th className="py-2 pr-4 w-28">Date</th>
              <th className="py-2 pr-4">Event</th>
              <th className="py-2 pr-4 w-48">Source</th>
              <th className="py-2 w-24">In filing</th>
              <th className="py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr
                key={e.id}
                className={`border-b border-slate-100 ${e.flaggedDuplicate ? "bg-amber-50" : ""} ${
                  e.includeInFiling ? "" : "opacity-40"
                }`}
              >
                <td className="py-2 pr-4 whitespace-nowrap font-medium">
                  {format(new Date(e.eventDate), "dd.MM.yyyy")}
                </td>
                <td className="py-2 pr-4">
                  {e.description}
                  {e.flaggedDuplicate && (
                    <span className="ml-2 text-[10px] text-amber-700 font-medium">possible duplicate</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-xs text-slate-400">
                  {e.sourceCard?.document ? (
                    <Link
                      href={`/matters/${matterId}/documents/${e.sourceCard.document.id}?card=${e.sourceCard.id}`}
                      className="hover:underline text-blue-600"
                    >
                      {e.sourceCard.document.filename.replace(/\.pdf$/i, "").slice(0, 22)} · p.
                      {e.sourceCard.page}
                      {e.sourceCard.para ? ` ¶${e.sourceCard.para}` : ""}
                    </Link>
                  ) : e.sourceCardId ? (
                    "Card (document removed)"
                  ) : (
                    "Manual"
                  )}
                </td>
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={e.includeInFiling}
                    onChange={() => toggleInclude(e)}
                  />
                </td>
                <td className="py-2 text-right">
                  {!e.sourceCardId && (
                    <button
                      onClick={() => removeManual(e)}
                      className="text-xs text-slate-300 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400 text-sm">
                  No entries yet. Create Date cards in the reader, or add a manual row below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <form onSubmit={addManual} className="mt-4 flex gap-2 items-center">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="border border-slate-200 rounded px-2 py-1.5 text-sm"
          data-testid="manual-date"
        />
        <input
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Event description…"
          className="flex-1 border border-slate-200 rounded px-3 py-1.5 text-sm"
          data-testid="manual-desc"
        />
        <button
          disabled={!newDate || !newDesc.trim()}
          className="rounded bg-slate-100 border border-slate-200 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          data-testid="manual-add"
        >
          Add row
        </button>
      </form>
    </div>
  );
}

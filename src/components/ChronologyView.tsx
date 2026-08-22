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
    <div className="px-10 py-14 max-w-5xl">
      <div className="flex items-end justify-between gap-8 mb-12">
        <div>
          <p className="eyebrow mb-3">List of dates</p>
          <h1 className="display text-[52px]">Chronology</h1>
          <p className="mt-4 text-[15px] leading-relaxed max-w-xl" style={{ color: "var(--text-secondary)" }}>
            Assembled from your Date cards. Add rows by hand, and take any row out of the filing
            before you export.
          </p>
        </div>
        <a
          href={`/api/matters/${matterId}/exports/list-of-dates`}
          className="btn-primary shrink-0 px-5 py-2.5 text-[13.5px]"
          data-testid="export-lod"
        >
          Export
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
        <table className="w-full border-collapse" data-testid="chronology-table">
          <thead>
            <tr className="text-left rule">
              <th className="eyebrow py-3 pr-6 w-32 font-medium">Date</th>
              <th className="eyebrow py-3 pr-6 font-medium">Event</th>
              <th className="eyebrow py-3 pr-6 w-52 font-medium">Source</th>
              <th className="eyebrow py-3 w-24 font-medium">In filing</th>
              <th className="py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr
                key={e.id}
                className={`row ${e.flaggedDuplicate ? "bg-amber-50" : ""} ${
                  e.includeInFiling ? "" : "opacity-40"
                }`}
              >
                <td className="tabular py-5 pr-6 whitespace-nowrap align-top text-[15px]">
                  {format(new Date(e.eventDate), "dd.MM.yyyy")}
                </td>
                <td className="py-5 pr-6 align-top text-[15px] leading-relaxed">
                  {e.description}
                  {e.flaggedDuplicate && (
                    <span className="ml-2 text-[10px] text-amber-700 font-medium">possible duplicate</span>
                  )}
                </td>
                <td className="py-5 pr-6 align-top text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                  {e.sourceCard?.document ? (
                    <Link
                      href={`/matters/${matterId}/documents/${e.sourceCard.document.id}?card=${e.sourceCard.id}`}
                      className="hover:underline"
                      style={{ color: "var(--text-secondary)" }}
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
                <td className="py-5 align-top">
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
                <td colSpan={5} className="py-16 text-center text-[15px]" style={{ color: "var(--text-tertiary)" }}>
                  Nothing here yet. Save a Date card while reading, or add a row below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <form onSubmit={addManual} className="mt-8 flex gap-2 items-center">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="field tabular px-3 py-2.5 text-[14px]"
          data-testid="manual-date"
        />
        <input
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Event description…"
          className="field flex-1 px-3.5 py-2.5 text-[14px]"
          data-testid="manual-desc"
        />
        <button
          disabled={!newDate || !newDesc.trim()}
          className="btn-quiet px-5 py-2.5 text-[13.5px] disabled:opacity-30"
          data-testid="manual-add"
        >
          Add row
        </button>
      </form>
    </div>
  );
}

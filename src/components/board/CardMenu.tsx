"use client";

import { useEffect, useRef, useState } from "react";
import { api, type CardDto } from "@/lib/clientTypes";

/**
 * The three dots on a personal note. One thing only: a reminder on a date,
 * which arrives by email that morning.
 *
 * Deliberately not offered on any other card type. Every other type records
 * something that already happened, and the chronology is assembled from those
 * dates, so a future date on one would quietly corrupt the List of Dates.
 */
export default function CardMenu({
  card,
  onChanged,
}: {
  card: CardDto;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(card.remindAt ? card.remindAt.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  if (card.cardType !== "MISC") return null;

  const save = async (value: string | null) => {
    setBusy(true);
    try {
      await api(`/api/cards/${card.id}`, {
        method: "PATCH",
        body: JSON.stringify({ remindAt: value }),
      });
      onChanged();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="relative" ref={box} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="More"
        aria-label="More"
        className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        data-testid="card-menu"
      >
        ⋯
      </button>

      {open && (
        <div
          className="absolute right-0 z-30 mt-1 w-60 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
          data-testid="card-menu-panel"
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            Remind me
          </p>
          <input
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
            data-testid="reminder-date"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            An email on that morning. A convenience, not a diary of record.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              disabled={!date || busy}
              onClick={() => save(date)}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              data-testid="reminder-save"
            >
              {busy ? "Saving…" : card.remindAt ? "Change" : "Set reminder"}
            </button>
            {card.remindAt && (
              <button
                disabled={busy}
                onClick={() => save(null)}
                className="text-xs text-slate-500 hover:text-slate-900"
                data-testid="reminder-clear"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

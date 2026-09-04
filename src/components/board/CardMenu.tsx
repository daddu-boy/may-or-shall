"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, type CardDto } from "@/lib/clientTypes";

/**
 * The three dots on a personal note. One thing only: a reminder on a date,
 * which arrives by email that morning.
 *
 * The panel is rendered into the body rather than beside the button. Each
 * column on the board scrolls, so a panel positioned inside one is clipped by
 * it, and a control that appears cut in half reads as broken however well it
 * works. It is placed from the button's measured position and flips above when
 * there is not room below.
 *
 * Deliberately not offered on any other card type. Every other type records
 * something that already happened, and the chronology is assembled from those
 * dates, so a future date on one would quietly corrupt the List of Dates.
 */
const PANEL_W = 248;
const PANEL_H = 190;

export default function CardMenu({
  card,
  onChanged,
}: {
  card: CardDto;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const [date, setDate] = useState(card.remindAt ? card.remindAt.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.right - PANEL_W, window.innerWidth - PANEL_W - 8));
    const below = r.bottom + 6;
    const top =
      below + PANEL_H > window.innerHeight - 8
        ? Math.max(8, r.top - PANEL_H - 6)
        : below;
    setAt({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const shut = () => setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    // the board scrolls under it, so close rather than drift out of place
    window.addEventListener("scroll", shut, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", shut, true);
      window.removeEventListener("resize", shut);
    };
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
    <>
      <button
        ref={btn}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="More"
        aria-label="More"
        aria-expanded={open}
        className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        data-testid="card-menu"
      >
        ⋯
      </button>

      {open &&
        at &&
        createPortal(
          <div
            ref={panel}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: at.top, left: at.left, width: PANEL_W }}
            className="z-[80] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
            data-testid="card-menu-panel"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Remind me
            </p>
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
              data-testid="reminder-date"
            />
            <p className="mt-2 text-[11px] leading-snug text-slate-400">
              An email that morning. A convenience, not a diary of record.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                disabled={!date || busy}
                onClick={() => save(date)}
                className="flex-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                data-testid="reminder-save"
              >
                {busy ? "Saving…" : card.remindAt ? "Change" : "Set reminder"}
              </button>
              {card.remindAt && (
                <button
                  disabled={busy}
                  onClick={() => save(null)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900"
                  data-testid="reminder-clear"
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

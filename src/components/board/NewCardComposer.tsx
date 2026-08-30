"use client";

import { useEffect, useRef, useState } from "react";
import { api, type CardDto, type DocumentDto } from "@/lib/clientTypes";
import {
  CARD_TYPES,
  CARD_TYPE_COLOR,
  cardTypeLabel,
  type CardTypeValue,
  type MatterKind,
} from "@/lib/labels";
import { extractDate } from "@/lib/dates";

const TAGS_KEY = "mos.board.tagsOpen";

/**
 * Write a card by hand.
 *
 * Every other card in the product comes from a source: a highlight in the
 * reader, a selection on a web page, an annotation imported out of a PDF. That
 * left nowhere to put the thing counsel said across the table, or the thought
 * you had on the way home, which is most of what a note actually is.
 *
 * A card with no document is already a first class citizen in the data model,
 * so this writes one and nothing else changes. Date cards still reach the
 * chronology on their own.
 */
export default function NewCardComposer({
  matterId,
  documents,
  kind,
  onSaved,
  onClose,
}: {
  matterId: string;
  documents: DocumentDto[];
  kind: MatterKind;
  onSaved: (card: CardDto) => void;
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [when, setWhen] = useState("");
  const [docId, setDocId] = useState("");
  const [page, setPage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tagsOpen, setTagsOpen] = useState(kind === "CASE");
  const area = useRef<HTMLTextAreaElement>(null);
  const touchedDate = useRef(false);

  useEffect(() => {
    area.current?.focus();
    const stored = localStorage.getItem(TAGS_KEY);
    if (stored !== null) setTagsOpen(stored === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem(TAGS_KEY, tagsOpen ? "1" : "0");
  }, [tagsOpen]);

  /** a note that mentions a date usually is one, so offer it rather than ask */
  useEffect(() => {
    if (touchedDate.current) return;
    setWhen(extractDate(body) ?? "");
  }, [body]);

  const save = async (cardType: CardTypeValue) => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      const card = await api<CardDto>(`/api/matters/${matterId}/cards`, {
        method: "POST",
        body: JSON.stringify({
          cardType,
          body: text,
          eventDate: when || null,
          ...(docId ? { documentId: docId } : {}),
          ...(docId && page ? { page: parseInt(page, 10) } : {}),
        }),
      });
      onSaved(card);
      setBody("");
      setWhen("");
      touchedDate.current = false;
      area.current?.focus();
    } catch (e) {
      setError((e as Error).message || "Could not save this note");
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save("MISC");
  };

  const field =
    "rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700";

  return (
    <div
      className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3"
      onKeyDown={onKeyDown}
      data-testid="new-card-composer"
    >
      <textarea
        ref={area}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Write a note. Anything you want to keep and cite later."
        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-indigo-400"
        data-testid="new-card-body"
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => save("MISC")}
          disabled={!body.trim() || busy}
          className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          data-testid="new-card-save"
        >
          {busy ? "Saving…" : "Save note"}
        </button>
        <button
          type="button"
          onClick={() => setTagsOpen((v) => !v)}
          aria-expanded={tagsOpen}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900"
          data-testid="new-card-tags"
        >
          {kind === "CASE" ? "Legal tags" : "Tags"} {tagsOpen ? "▴" : "▾"}
        </button>

        <span className="mx-1 text-slate-200">|</span>

        <label className="text-xs text-slate-400">Date</label>
        <input
          type="date"
          value={when}
          onChange={(e) => {
            touchedDate.current = true;
            setWhen(e.target.value);
          }}
          className={field}
          data-testid="new-card-date"
        />

        {documents.length > 0 && (
          <>
            <select
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              className={field}
              data-testid="new-card-doc"
            >
              <option value="">No document</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </select>
            {docId && (
              <input
                value={page}
                onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))}
                placeholder="p."
                inputMode="numeric"
                className={`${field} w-14`}
                data-testid="new-card-page"
              />
            )}
          </>
        )}

        <button
          onClick={onClose}
          className="ml-auto text-xs text-slate-400 hover:text-slate-700"
        >
          Close
        </button>
      </div>

      {tagsOpen && (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
            Save it as
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CARD_TYPES.filter((t) => t !== "MISC").map((t) => (
              <button
                key={t}
                disabled={!body.trim() || busy}
                onClick={() => save(t)}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
                style={{ background: CARD_TYPE_COLOR[t] }}
                data-testid={`new-card-chip-${t}`}
              >
                {cardTypeLabel(t, kind)}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

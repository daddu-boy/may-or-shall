"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type CardDto, type DocumentDto } from "@/lib/clientTypes";
import {
  CARD_TYPE_COLOR,
  LINK_KINDS,
  LINK_KIND_LABEL,
  type CardTypeValue,
  type LinkKindValue,
} from "@/lib/labels";
import dynamic from "next/dynamic";

// pdf.js touches DOM APIs at module scope, so the reader is client only. A
// static import here renders it on the server on a hard load and the page 500s,
// which is exactly what happened.
const Reader = dynamic(() => import("./reader/Reader"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-slate-400">Loading reader…</p>,
});

interface LinkDto {
  id: string;
  matterId: string;
  fromCardId: string;
  toCardId: string;
  kind: LinkKindValue;
  note: string;
  suggested: boolean;
}

/**
 * Two documents open at once, with the ability to drag a highlight in one onto
 * a highlight in the other to link them: the plaint paragraph and the annexure
 * it refers to.
 *
 * Two panes rather than four. A PDF needs roughly half a screen to be legible,
 * so more columns would mean unreadable slivers; the other documents sit in the
 * pickers and swap into either side.
 */
export default function CompareDesk({
  matterId,
  documents,
}: {
  matterId: string;
  documents: DocumentDto[];
}) {
  const ready = useMemo(() => documents.filter((d) => d.status === "ready"), [documents]);
  const [leftId, setLeftId] = useState(ready[0]?.id ?? "");
  const [rightId, setRightId] = useState(ready[1]?.id ?? ready[0]?.id ?? "");
  const [links, setLinks] = useState<LinkDto[]>([]);
  const [cards, setCards] = useState<CardDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  /**
   * Linking is done by picking two cards, not by dragging highlights. pdf.js
   * renders its text layer above the highlight overlay, so a drag on a
   * highlight never reaches it, and putting highlights on top would break the
   * text selection that creates cards in the first place. Picking is also
   * easier to aim at: you choose from a list showing the actual passage.
   */
  const [slotA, setSlotA] = useState<string | null>(null);
  const [slotB, setSlotB] = useState<string | null>(null);

  const pick = (cardId: string) => {
    if (slotA === cardId || slotB === cardId) return;
    if (!slotA) setSlotA(cardId);
    else if (!slotB) setSlotB(cardId);
    else setSlotB(cardId); // both full: replace the second
  };

  const load = useCallback(async () => {
    const [l, c] = await Promise.all([
      api<LinkDto[]>(`/api/matters/${matterId}/links`),
      api<CardDto[]>(`/api/matters/${matterId}/cards`),
    ]);
    setLinks(l);
    setCards(c);
  }, [matterId]);

  useEffect(() => {
    load();
  }, [load]);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const docById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents]);

  const linkedCardIds = useMemo(() => {
    const s = new Set<string>();
    for (const l of links) {
      s.add(l.fromCardId);
      s.add(l.toCardId);
    }
    return s;
  }, [links]);

  const createLink = useCallback(
    async (fromCardId: string, toCardId: string) => {
      setBusy(true);
      try {
        await api(`/api/matters/${matterId}/links`, {
          method: "POST",
          body: JSON.stringify({ fromCardId, toCardId }),
        });
        await load();
        setSlotA(null);
        setSlotB(null);
        setFlash("Linked");
        setTimeout(() => setFlash(null), 1600);
      } finally {
        setBusy(false);
      }
    },
    [matterId, load]
  );

  const setKind = async (id: string, kind: LinkKindValue) => {
    await api(`/api/links/${id}`, { method: "PATCH", body: JSON.stringify({ kind }) });
    load();
  };

  const remove = async (id: string) => {
    await api(`/api/links/${id}`, { method: "DELETE" });
    load();
  };

  if (ready.length === 0) {
    return (
      <div className="p-10 text-sm text-slate-500">
        Upload at least one document to this matter first.
      </div>
    );
  }

  const picker = (value: string, onChange: (v: string) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-slate-200 rounded px-2 py-1 bg-white max-w-[22rem]"
    >
      {ready.map((d) => (
        <option key={d.id} value={d.id}>
          {d.annexureLabel ? `${d.annexureLabel} · ` : ""}
          {d.filename}
        </option>
      ))}
    </select>
  );

  const endpoint = (cardId: string) => {
    const c = cardById.get(cardId);
    if (!c) return <span className="text-slate-400">(card deleted)</span>;
    const doc = c.documentId ? docById.get(c.documentId) : null;
    return (
      <span>
        <span
          className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
          style={{ background: CARD_TYPE_COLOR[c.cardType as CardTypeValue] }}
        />
        <span className="text-slate-700">{(c.quote || c.body).slice(0, 60)}</span>
        <span className="text-slate-400">
          {" "}
          — {doc ? doc.annexureLabel || doc.filename : c.sourceTitle || "web"}
          {c.page ? `, p.${c.page}` : ""}
          {c.para ? `, para ${c.para}` : ""}
        </span>
      </span>
    );
  };

  /** The passages saved from one document, as a list you can actually click. */
  const rail = (docId: string) => {
    const mine = cards.filter((c) => c.documentId === docId);
    return (
      <div className="w-52 shrink-0 border-l border-slate-200 bg-slate-50 flex flex-col">
        <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-200">
          Cards here ({mine.length})
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1.5">
          {mine.length === 0 && (
            <p className="text-[11px] text-slate-400 px-1">
              Highlight a passage in this document to create a card.
            </p>
          )}
          {mine.map((c) => {
            const chosen = c.id === slotA || c.id === slotB;
            return (
              <button
                key={c.id}
                onClick={() => pick(c.id)}
                className={`w-full text-left rounded-lg border px-2 py-1.5 text-[11px] leading-snug transition ${
                  chosen
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: CARD_TYPE_COLOR[c.cardType as CardTypeValue] }}
                  />
                  <span className="text-slate-400">
                    {c.page ? `p.${c.page}` : ""}
                    {c.para ? ` ¶${c.para}` : ""}
                  </span>
                  {linkedCardIds.has(c.id) && (
                    <span className="ml-auto text-slate-400" title="already linked">
                      &#9679;
                    </span>
                  )}
                </span>
                <span className="text-slate-700 line-clamp-3">{c.quote || c.body}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const pane = (
    docId: string,
    setDocId: (v: string) => void,
    side: "left" | "right"
  ) => (
    <div className={`flex-1 min-w-0 flex flex-col ${side === "left" ? "border-r border-slate-200" : ""}`}>
      <div className="h-11 shrink-0 border-b border-slate-200 bg-white flex items-center gap-2 px-3">
        <span className="text-[11px] uppercase tracking-wide text-slate-400 shrink-0">
          {side === "left" ? "Left" : "Right"}
        </span>
        {picker(docId, setDocId)}
      </div>
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0">
          {docId && (
            <Reader
              key={docId}
              matterId={matterId}
              docId={docId}
              compact
              linkedCardIds={linkedCardIds}
              onCardsChanged={load}
            />
          )}
        </div>
        {rail(docId)}
      </div>
    </div>
  );

  const slotView = (cardId: string | null, label: string, clear: () => void) => {
    const c = cardId ? cardById.get(cardId) : null;
    return (
      <div
        className={`flex-1 min-w-0 rounded-lg border px-2.5 py-1.5 text-xs ${
          c ? "border-indigo-300 bg-white" : "border-dashed border-slate-300 bg-slate-50"
        }`}
      >
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
        {c ? (
          <span className="flex items-center gap-2">
            <span className="truncate text-slate-700">{(c.quote || c.body).slice(0, 70)}</span>
            <button onClick={clear} className="ml-auto shrink-0 text-slate-400 hover:text-slate-600">
              &times;
            </button>
          </span>
        ) : (
          <span className="block text-slate-400">Click a card in either list</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 flex items-center gap-2 px-4 py-2">
        {slotView(slotA, "First", () => setSlotA(null))}
        {slotView(slotB, "Second", () => setSlotB(null))}
        <button
          disabled={!slotA || !slotB || busy}
          onClick={() => slotA && slotB && createLink(slotA, slotB)}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-30"
        >
          Link these
        </button>
        {flash && <span className="text-xs font-medium text-emerald-600">{flash}</span>}
        {ready.length < 2 && (
          <span className="text-xs text-amber-600">
            Only one document in this matter, so both panes show the same one. Upload another to
            compare.
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 flex">
        {pane(leftId, setLeftId, "left")}
        {pane(rightId, setRightId, "right")}

        <aside className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col">
        <div className="h-10 shrink-0 border-b border-slate-200 flex items-center px-4">
          <h2 className="text-sm font-medium">Links</h2>
          <span className="ml-auto text-xs text-slate-400">{links.length}</span>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {links.length === 0 && (
            <p className="text-xs text-slate-400">
              No links yet. Highlight a passage in each document to make a card, then pick one
              from each list above and press Link these.
            </p>
          )}
          {links.map((l) => (
            <div
              key={l.id}
              className={`rounded-lg border p-2.5 text-xs ${
                l.suggested ? "border-dashed border-indigo-300 bg-indigo-50/40" : "border-slate-200"
              }`}
            >
              {l.suggested && (
                <p className="mb-1 text-[11px] font-medium text-indigo-600">Suggested</p>
              )}
              <div className="mb-1">{endpoint(l.fromCardId)}</div>
              <select
                value={l.kind}
                onChange={(e) => setKind(l.id, e.target.value as LinkKindValue)}
                className="my-1 text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white"
              >
                {LINK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LINK_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <div className="mt-1">{endpoint(l.toCardId)}</div>
              <button
                onClick={() => remove(l.id)}
                disabled={busy}
                className="mt-2 text-[11px] text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

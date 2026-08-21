"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** card each pane should scroll to; the nonce allows repeat requests */
  const [focusLeft, setFocusLeft] = useState<{ cardId: string; nonce: number } | null>(null);
  const [focusRight, setFocusRight] = useState<{ cardId: string; nonce: number } | null>(null);
  const nonce = useRef(0);
  /** how the width is split between the two documents, dragged by the divider */
  const [split, setSplit] = useState(50);
  const dragging = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);
  /** the floating panel: translucent while you read, solid once you engage */
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelSolid, setPanelSolid] = useState(false);

  /**
   * Open a linked passage. A link is only worth drawing if you can follow it,
   * so clicking either end loads that card's document into a pane and scrolls
   * to the highlight. The pane already showing that document is reused;
   * otherwise the right one takes it, so the passage you came from stays put.
   */
  const reveal = (cardId: string) => {
    const card = cardById.get(cardId);
    if (!card?.documentId) return;
    const req = { cardId, nonce: ++nonce.current };
    if (leftId === card.documentId) setFocusLeft(req);
    else if (rightId === card.documentId) setFocusRight(req);
    else {
      setRightId(card.documentId);
      setFocusRight(req);
    }
  };

  // Drag the divider to give whichever document needs it more room.
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current || !rowRef.current) return;
      const r = rowRef.current.getBoundingClientRect();
      const pct = ((e.clientX - r.left) / r.width) * 100;
      setSplit(Math.min(78, Math.max(22, pct)));
    };
    const up = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

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
      <button
        type="button"
        onClick={() => reveal(cardId)}
        title="Open this passage"
        className="block w-full text-left rounded-md px-1 py-0.5 -mx-1 hover:bg-[var(--surface-sunken)]"
      >
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
      </button>
    );
  };

  /**
   * The passages saved from one document. Clicking one goes to it in the
   * document, which is what you want nine times out of ten; picking it for a
   * link is the separate control on the right, so the two never fight.
   */
  const rail = (docId: string) => {
    const doc = docById.get(docId);
    const mine = cards.filter((c) => c.documentId === docId);
    return (
      <div className="flex flex-col min-h-0">
        <div
          className="px-3 py-1.5 text-[11px] font-medium border-b sticky top-0 truncate"
          style={{
            color: "var(--text-secondary)",
            borderColor: "var(--hairline)",
            background: "var(--surface-sunken)",
          }}
          title={doc?.filename}
        >
          {doc ? doc.annexureLabel || doc.filename : "Document"} ({mine.length})
        </div>
        <div className="overflow-auto p-2 space-y-1.5 max-h-64">
          {mine.length === 0 && (
            <p className="text-[11px] px-1" style={{ color: "var(--text-tertiary)" }}>
              Highlight a passage in this document to create a card.
            </p>
          )}
          {mine.map((c) => {
            const chosen = c.id === slotA || c.id === slotB;
            return (
              <div
                key={c.id}
                className="w-full rounded-[10px] border flex items-start gap-1.5 pr-1.5 transition-colors"
                style={{
                  borderColor: chosen ? "var(--accent)" : "var(--hairline)",
                  background: chosen ? "var(--accent-soft)" : "var(--surface)",
                }}
              >
                <button
                  onClick={() => reveal(c.id)}
                  title="Go to this passage in the document"
                  className="flex-1 min-w-0 text-left px-2 py-1.5 text-[11px] leading-snug"
                >
                  <span className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: CARD_TYPE_COLOR[c.cardType as CardTypeValue] }}
                    />
                    <span style={{ color: "var(--text-tertiary)" }}>
                      {c.page ? `p.${c.page}` : ""}
                      {c.para ? ` \u00b6${c.para}` : ""}
                    </span>
                    {linkedCardIds.has(c.id) && (
                      <span style={{ color: "var(--text-tertiary)" }} title="already linked">
                        &#9679;
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-3" style={{ color: "var(--text)" }}>
                    {c.quote || c.body}
                  </span>
                </button>
                <button
                  onClick={() => pick(c.id)}
                  title={chosen ? "Picked for linking" : "Pick this for a link"}
                  className="mt-1.5 w-5 h-5 shrink-0 rounded-full border text-[10px] leading-none flex items-center justify-center"
                  style={{
                    borderColor: chosen ? "var(--accent)" : "var(--hairline-strong)",
                    background: chosen ? "var(--accent)" : "transparent",
                    color: chosen ? "#fff" : "var(--text-tertiary)",
                  }}
                >
                  {chosen ? "\u2713" : "+"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const pane = (
    docId: string,
    setDocId: (v: string) => void,
    side: "left" | "right",
    focusReq: { cardId: string; nonce: number } | null
  ) => (
    <div className="min-w-0 flex flex-col h-full">
      <div
        className="h-12 shrink-0 flex items-center px-3"
        style={{ borderBottom: "1px solid var(--hairline)", background: "var(--surface)" }}
      >
        {picker(docId, setDocId)}
      </div>
      <div className="flex-1 min-h-0">
        {docId && (
          <Reader
            key={docId}
            matterId={matterId}
            docId={docId}
            compact
            focus={focusReq}
            linkedCardIds={linkedCardIds}
            onCardsChanged={load}
          />
        )}
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
          <span className="block" style={{ color: "var(--text-tertiary)" }}>Press + on a card below</span>
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
      <div ref={rowRef} className="flex-1 min-h-0 flex relative">
        <div style={{ width: `${split}%` }} className="min-w-0">
          {pane(leftId, setLeftId, "left", focusLeft)}
        </div>

        {/* drag to give whichever document needs the room */}
        <div
          onMouseDown={() => {
            dragging.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          onDoubleClick={() => setSplit(50)}
          title="Drag to resize. Double click to even them up."
          className="w-1 shrink-0 cursor-col-resize relative group"
          style={{ background: "var(--hairline)" }}
        >
          <span
            className="absolute inset-y-0 -left-1 -right-1"
            aria-hidden
          />
          <span
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "var(--text-tertiary)" }}
          />
        </div>

        <div style={{ width: `${100 - split}%` }} className="min-w-0">
          {pane(rightId, setRightId, "right", focusRight)}
        </div>

        {/*
          The cards and links float above the documents rather than taking a
          third column: two PDFs need the width more than a panel does. It sits
          translucent while you read and turns solid the moment you touch it.
        */}
        {!panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            className="absolute right-4 top-4 z-20 rounded-full px-3.5 py-2 text-xs font-medium"
            style={{
              background: "rgba(255,255,255,.8)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              border: "1px solid var(--hairline)",
              boxShadow: "0 8px 28px rgba(0,0,0,.10)",
            }}
          >
            Cards and links
          </button>
        )}

        {panelOpen && (
          <aside
            onMouseEnter={() => setPanelSolid(true)}
            onMouseLeave={() => setPanelSolid(false)}
            className="absolute right-4 top-4 bottom-4 w-[21rem] z-20 flex flex-col rounded-2xl overflow-hidden transition-all"
            style={{
              background: panelSolid ? "rgba(255,255,255,.985)" : "rgba(255,255,255,.72)",
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: "1px solid var(--hairline)",
              boxShadow: panelSolid
                ? "0 16px 48px rgba(0,0,0,.16)"
                : "0 10px 30px rgba(0,0,0,.08)",
            }}
          >
            <div
              className="h-11 shrink-0 flex items-center px-4"
              style={{ borderBottom: "1px solid var(--hairline)" }}
            >
              <h2 className="text-[13px] font-medium">Cards and links</h2>
              <button
                onClick={() => setPanelOpen(false)}
                title="Hide, so both documents get the full width"
                className="ml-auto text-sm"
                style={{ color: "var(--text-tertiary)" }}
              >
                &times;
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <div style={{ borderBottom: "1px solid var(--hairline)" }}>
                {rail(leftId)}
                {rail(rightId)}
              </div>
              <div className="px-4 py-2 flex items-center">
                <h3 className="text-[13px] font-medium">Links</h3>
                <span className="ml-auto text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {links.length}
                </span>
              </div>
              <div className="px-3 pb-3 space-y-3">
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
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
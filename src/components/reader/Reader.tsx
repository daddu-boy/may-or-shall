"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { api, type CardDto, type DocumentDto, type HighlightRect } from "@/lib/clientTypes";
import { CARD_TYPES, CARD_TYPE_COLOR, CARD_TYPE_LABEL, type CardTypeValue } from "@/lib/labels";
import { extractDate } from "@/lib/dates";
import PdfPage from "./PdfPage";
import CardPanel from "./CardPanel";

// Served from /public (copied from node_modules/pdfjs-dist/build by
// scripts/copy-pdf-worker.mjs on postinstall) — bundling the worker via
// new URL() conflicts with pdfjs-dist being a server external.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PendingHighlight {
  page: number;
  rects: HighlightRect[];
  quote: string;
  /** viewport coords for the popover anchor */
  anchorX: number;
  anchorY: number;
}

export default function Reader({
  matterId,
  docId,
  initialPage,
  initialCardId,
}: {
  matterId: string;
  docId: string;
  initialPage?: number;
  initialCardId?: string;
}) {
  const [doc, setDoc] = useState<DocumentDto | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [cards, setCards] = useState<CardDto[]>([]);
  const [scale, setScale] = useState(1.2);
  const [pending, setPending] = useState<PendingHighlight | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(initialCardId ?? null);
  const [pageSizes, setPageSizes] = useState<{ w: number; h: number }[]>([]);
  const [pageInput, setPageInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<{ page: number; snippet: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const didInitialScroll = useRef(false);

  // ---- load document meta, pdf bytes and cards ------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meta, cardList] = await Promise.all([
          api<DocumentDto>(`/api/documents/${docId}`),
          api<CardDto[]>(`/api/matters/${matterId}/cards?documentId=${docId}`),
        ]);
        if (cancelled) return;
        setDoc(meta);
        setCards(cardList);
        const loadingTask = pdfjs.getDocument({ url: `/api/documents/${docId}/file` });
        const loaded = await loadingTask.promise;
        if (cancelled) {
          loadingTask.destroy();
          return;
        }
        // Page 1's size seeds placeholders; real sizes replace them as pages load.
        const first = await loaded.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        setPageSizes(new Array(loaded.numPages).fill({ w: vp.width, h: vp.height }));
        setPdf(loaded);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docId, matterId]);

  const refreshCards = useCallback(async () => {
    setCards(await api<CardDto[]>(`/api/matters/${matterId}/cards?documentId=${docId}`));
  }, [matterId, docId]);

  const reportPageSize = useCallback((page: number, w: number, h: number) => {
    setPageSizes((sizes) => {
      if (sizes[page - 1]?.w === w && sizes[page - 1]?.h === h) return sizes;
      const next = [...sizes];
      next[page - 1] = { w, h };
      return next;
    });
  }, []);

  // ---- navigation ------------------------------------------------------------
  const scrollToPage = useCallback((page: number, yFrac = 0) => {
    const el = pageRefs.current.get(page);
    const scroller = scrollRef.current;
    if (!el || !scroller) return;
    scroller.scrollTo({ top: el.offsetTop + el.offsetHeight * yFrac - 80, behavior: "smooth" });
  }, []);

  const jumpToCard = useCallback(
    (card: CardDto) => {
      setSelectedCardId(card.id);
      if (card.page) {
        const y = card.rects.length ? Math.min(...card.rects.map((r) => r.y)) : 0;
        scrollToPage(card.page, y);
      }
    },
    [scrollToPage]
  );

  // Deep-link: scroll to ?page= or ?card= once the pdf is ready.
  useEffect(() => {
    if (!pdf || didInitialScroll.current) return;
    didInitialScroll.current = true;
    setTimeout(() => {
      if (initialCardId) {
        const card = cards.find((c) => c.id === initialCardId);
        if (card) jumpToCard(card);
      } else if (initialPage) {
        scrollToPage(initialPage);
      }
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf]);

  // ---- selection → pending highlight ----------------------------------------
  const onMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const quote = sel.toString().replace(/\s+/g, " ").trim();
    if (!quote) return;

    // Find which page the selection starts in.
    let node: Node | null = range.startContainer;
    let pageEl: HTMLElement | null = null;
    while (node) {
      if (node instanceof HTMLElement && node.dataset.pdfPage) {
        pageEl = node;
        break;
      }
      node = node.parentNode;
    }
    if (!pageEl) return;
    const page = parseInt(pageEl.dataset.pdfPage!, 10);
    const pageBox = pageEl.getBoundingClientRect();

    const seen = new Set<string>();
    const rects: HighlightRect[] = [];
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 2 || r.height < 2) continue;
      const rect: HighlightRect = {
        page,
        x: (r.left - pageBox.left) / pageBox.width,
        y: (r.top - pageBox.top) / pageBox.height,
        w: r.width / pageBox.width,
        h: r.height / pageBox.height,
      };
      const key = [rect.x, rect.y, rect.w, rect.h].map((v) => v.toFixed(3)).join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      rects.push(rect);
    }
    if (rects.length === 0) return;

    const last = range.getClientRects()[range.getClientRects().length - 1];
    setPending({ page, rects, quote, anchorX: last.right, anchorY: last.bottom });
  }, []);

  const saveCard = useCallback(
    async (cardType: CardTypeValue, note: string, eventDate: string | null) => {
      if (!pending) return;
      const card = await api<CardDto>(`/api/matters/${matterId}/cards`, {
        method: "POST",
        body: JSON.stringify({
          documentId: docId,
          page: pending.page,
          quote: pending.quote,
          rects: pending.rects,
          cardType,
          body: note,
          eventDate: cardType === "DATE" ? eventDate : null,
        }),
      });
      setPending(null);
      window.getSelection()?.removeAllRanges();
      setCards((c) => [...c, card]);
      setSelectedCardId(card.id);
    },
    [pending, matterId, docId]
  );

  // ---- in-document search ----------------------------------------------------
  useEffect(() => {
    if (searchQ.trim().length < 2) {
      setSearchHits(null);
      return;
    }
    const t = setTimeout(async () => {
      setSearchHits(await api(`/api/documents/${docId}/search?q=${encodeURIComponent(searchQ)}`));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ, docId]);

  const cardsByPage = useMemo(() => {
    const map = new Map<number, CardDto[]>();
    for (const c of cards) {
      if (!c.page) continue;
      if (!map.has(c.page)) map.set(c.page, []);
      map.get(c.page)!.push(c);
    }
    return map;
  }, [cards]);

  if (error) {
    return <p className="p-6 text-sm text-red-600">Failed to load document: {error}</p>;
  }
  if (!doc || !pdf) {
    return <p className="p-6 text-sm text-slate-400">Loading document…</p>;
  }

  return (
    <div className="flex h-full">
      {/* main reader column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-11 shrink-0 border-b border-slate-200 bg-white flex items-center gap-3 px-4 text-sm">
          <span className="font-medium truncate max-w-xs">{doc.filename}</span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setScale((s) => Math.max(0.6, +(s - 0.2).toFixed(1)))} className="px-2 py-0.5 rounded hover:bg-slate-100">−</button>
            <span className="text-xs text-slate-500 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((s) => Math.min(2.4, +(s + 0.2).toFixed(1)))} className="px-2 py-0.5 rounded hover:bg-slate-100">+</button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = parseInt(pageInput, 10);
              if (n >= 1 && n <= doc.pageCount) scrollToPage(n);
            }}
            className="flex items-center gap-1 text-xs text-slate-500"
          >
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              placeholder="p."
              className="w-12 border border-slate-200 rounded px-1.5 py-0.5"
            />
            / {doc.pageCount}
          </form>
          <div className="relative ml-auto">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Find in document…"
              className="w-56 border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50"
            />
            {searchHits && (
              <div className="absolute right-0 top-8 w-80 max-h-72 overflow-auto bg-white border border-slate-200 rounded-lg shadow-xl z-40 text-xs">
                {searchHits.length === 0 && <p className="p-2 text-slate-400">No matches.</p>}
                {searchHits.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      scrollToPage(h.page);
                      setSearchHits(null);
                      setSearchQ("");
                    }}
                    className="block w-full text-left px-2 py-1.5 hover:bg-slate-50 border-b border-slate-50"
                  >
                    <span className="font-medium text-slate-500">p.{h.page}</span>{" "}
                    <span className="text-slate-600">…{h.snippet}…</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!doc.hasTextLayer && (
            <span className="text-xs text-amber-600">No text layer — highlighting unavailable</span>
          )}
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-auto bg-slate-100"
          onMouseUp={onMouseUp}
          data-testid="pdf-scroll"
        >
          <div className="flex flex-col items-center py-6 gap-4">
            {pageSizes.map((size, i) => (
              <PdfPage
                key={i}
                pdf={pdf}
                pageNumber={i + 1}
                scale={scale}
                width={size.w}
                height={size.h}
                cards={cardsByPage.get(i + 1) ?? []}
                selectedCardId={selectedCardId}
                onSelectCard={setSelectedCardId}
                onSize={reportPageSize}
                registerRef={(page, el) => {
                  if (el) pageRefs.current.set(page, el);
                  else pageRefs.current.delete(page);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* highlight popover */}
      {pending && (
        <HighlightPopover
          pending={pending}
          onSave={saveCard}
          onDismiss={() => setPending(null)}
        />
      )}

      {/* right card panel */}
      <CardPanel
        cards={cards}
        selectedCardId={selectedCardId}
        onSelect={jumpToCard}
        onChanged={refreshCards}
      />
    </div>
  );
}

function HighlightPopover({
  pending,
  onSave,
  onDismiss,
}: {
  pending: PendingHighlight;
  onSave: (type: CardTypeValue, note: string, eventDate: string | null) => Promise<void>;
  onDismiss: () => void;
}) {
  const [note, setNote] = useState("");
  const [dateValue, setDateValue] = useState(() => extractDate(pending.quote) ?? "");
  const [askDate, setAskDate] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = async (type: CardTypeValue) => {
    if (type === "DATE" && !askDate) {
      setAskDate(true);
      return;
    }
    setBusy(true);
    try {
      await onSave(type, note, type === "DATE" ? dateValue || null : null);
    } finally {
      setBusy(false);
    }
  };

  const left = Math.min(pending.anchorX, window.innerWidth - 340);
  const top = Math.min(pending.anchorY + 8, window.innerHeight - 240);

  return (
    <div
      className="fixed z-50 w-80 rounded-lg border border-slate-200 bg-white shadow-2xl p-3"
      style={{ left, top }}
      data-testid="highlight-popover"
    >
      <p className="text-xs text-slate-400 line-clamp-2 mb-2">“{pending.quote}”</p>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note…"
        className="w-full border border-slate-200 rounded px-2 py-1 text-xs mb-2"
        data-testid="popover-note"
      />
      {askDate && (
        <div className="flex items-center gap-2 mb-2">
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs"
            data-testid="popover-date"
          />
          <button
            disabled={!dateValue || busy}
            onClick={() => pick("DATE")}
            className="text-xs bg-slate-900 text-white rounded px-2 py-1 disabled:opacity-40"
            data-testid="popover-date-save"
          >
            Save date card
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {CARD_TYPES.map((t) => (
          <button
            key={t}
            disabled={busy}
            onClick={() => pick(t)}
            className="text-xs rounded-full px-2.5 py-1 font-medium text-white disabled:opacity-40"
            style={{ background: CARD_TYPE_COLOR[t], opacity: askDate && t !== "DATE" ? 0.35 : 1 }}
            data-testid={`chip-${t}`}
          >
            {CARD_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <button onClick={onDismiss} className="mt-2 text-xs text-slate-400 hover:text-slate-600">
        Dismiss
      </button>
    </div>
  );
}

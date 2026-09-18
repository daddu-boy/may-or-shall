"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import Link from "next/link";
import { api, type CardDto, type DocumentDto, type HighlightRect } from "@/lib/clientTypes";
import {
  CARD_TYPES,
  CARD_TYPE_COLOR,
  cardTypeLabel,
  type CardTypeValue,
  type MatterKind,
} from "@/lib/labels";
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
  compact = false,
  kind = "CASE",
  linkedCardIds,
  focus,
  onCardsChanged,
}: {
  matterId: string;
  docId: string;
  initialPage?: number;
  initialCardId?: string;
  /** in a side by side pane: no card panel of its own, the desk owns that */
  compact?: boolean;
  kind?: MatterKind;
  linkedCardIds?: Set<string>;
  /**
   * Scroll to and select a card. The nonce lets the same card be requested
   * twice in a row (clicking it again should still bring you back to it).
   */
  focus?: { cardId: string; nonce: number } | null;
  onCardsChanged?: () => void;
}) {
  const [doc, setDoc] = useState<DocumentDto | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [cards, setCards] = useState<CardDto[]>([]);
  const [scale, setScale] = useState(1.2);
  /**
   * Fit to width is the default and it is not a one off: with a draggable
   * divider the pane changes size constantly, and the document should follow
   * rather than needing to be re-zoomed by hand every time. Typing a number
   * switches to that number and stays there until Fit is pressed again.
   */
  const [fitWidth, setFitWidth] = useState(true);
  const [zoomText, setZoomText] = useState("");
  const [pending, setPending] = useState<PendingHighlight | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(initialCardId ?? null);
  const [pageSizes, setPageSizes] = useState<{ w: number; h: number }[]>([]);
  const [pageInput, setPageInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<{ page: number; snippet: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qualityOpen, setQualityOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(1024);

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

  /*
   * The bar answers to its own width, not the window's: the cards rail, the
   * side by side workspace and a narrow window all squeeze it, and a viewport
   * breakpoint knows about none of them. Measured after every render as well
   * as on resize, because the bar only exists once the document has loaded.
   */
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => setBarWidth((w) => (Math.abs(w - el.clientWidth) > 1 ? el.clientWidth : w));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  });

  const refreshCards = useCallback(async () => {
    setCards(await api<CardDto[]>(`/api/matters/${matterId}/cards?documentId=${docId}`));
    onCardsChanged?.(); // the desk keeps its own list of cards and links
  }, [matterId, docId, onCardsChanged]);

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

  /**
   * Follow a focus request. This waits for the cards as well as the pdf: the
   * two load independently, and scrolling used to be attempted on a fixed
   * timer after the pdf arrived, which usually lost the race and silently did
   * nothing. Depending on `cards` means it simply runs again when they land.
   */
  useEffect(() => {
    if (!pdf || !focus?.cardId) return;
    const card = cards.find((c) => c.id === focus.cardId);
    if (!card) return;
    const t = setTimeout(() => jumpToCard(card), 120);
    return () => clearTimeout(t);
  }, [pdf, cards, focus?.cardId, focus?.nonce, jumpToCard]);

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

  /** Recompute the fit whenever the pane resizes or the document changes. */
  useEffect(() => {
    const scroller = scrollRef.current;
    const baseW = pageSizes[0]?.w;
    if (!scroller || !baseW) return;
    const apply = () => {
      if (!fitWidth) return;
      const avail = scroller.clientWidth - 48; // page margins either side
      if (avail <= 0) return;
      setScale(Math.min(3, Math.max(0.35, avail / baseW)));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [fitWidth, pageSizes]);

  const setManualScale = (next: number) => {
    setFitWidth(false);
    setScale(Math.min(3, Math.max(0.35, next)));
  };

  const commitZoomText = () => {
    const n = parseInt(zoomText.replace(/[^0-9]/g, ""), 10);
    // clamp rather than ignore: typing 500 should give you the maximum, not
    // silently nothing
    if (!Number.isNaN(n)) setManualScale(Math.min(300, Math.max(35, n)) / 100);
    setZoomText("");
  };

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

  /*
   * What is worth knowing about this document's text, in the order it matters.
   * Kept as plain sentences so the chip can simply list them.
   */
  const quality: string[] = [];
  if (doc && !doc.hasTextLayer) {
    quality.push("This file carries no selectable text of its own, so what you read here came from recognition.");
  }
  if (doc?.extractionReport?.ocr === "completed") {
    quality.push("The text was recognised from the page image. Check any passage you quote against the page itself.");
  }
  if (doc?.extractionReport?.warningPages?.length) {
    quality.push(
      `Little text was found on page${doc.extractionReport.warningPages.length === 1 ? "" : "s"} ` +
        `${doc.extractionReport.warningPages.join(", ")}, so passages there may be incomplete.`
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-lg text-sm">
        <h2 className="text-base font-semibold mb-2">This PDF did not open</h2>
        <p className="mb-3" style={{ color: "var(--text-secondary)" }}>
          May or Shall could not display {doc?.filename ? `"${doc.filename}"` : "this document"}. This
          usually means the file is password protected, was damaged before it was uploaded, or is
          larger than the reader can handle. Your cards from it are safe.
        </p>
        <p className="mb-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
          Reported by the reader: {error}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => location.reload()} className="btn-primary px-4 py-2 text-xs">
            Try again
          </button>
          <a
            href={`/api/documents/${docId}/file?original=1`}
            target="_blank"
            rel="noreferrer"
            className="btn-quiet px-4 py-2 text-xs"
          >
            Download the original
          </a>
          <Link href={`/matters/${matterId}/documents`} className="btn-quiet px-4 py-2 text-xs">
            Back to documents
          </Link>
        </div>
        <p className="mt-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
          If it opens elsewhere but not here, send it to sdhkapr22@gmail.com and it will be looked at.
        </p>
      </div>
    );
  }
  if (!doc || !pdf) {
    return (
      <p className="p-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        Opening the document… Large scans can take a few seconds.
      </p>
    );
  }

  /*
   * What fits. The bar is squeezed by the cards rail and by the side by side
   * workspace, so each part has a width below which it costs more than it is
   * worth. Nothing is ever cut off: it leaves in order of usefulness.
   */
  const showSearch = !compact && barWidth >= 620;
  const showPages = barWidth >= 430;
  const showName = barWidth >= 320;
  const chipLabel = barWidth >= 380;

  return (
    <div className="flex h-full">
      {/* main reader column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/*
          One row that never wraps. The text quality warnings used to be two
          full sentences sitting in the flow, so on a narrow pane they wrapped
          over the controls and spilled into the cards rail. They are now a
          single chip that opens what it has to say.
        */}
        <div
          ref={barRef}
          className="h-11 shrink-0 border-b border-slate-200 bg-white flex items-center gap-2 px-3 text-sm flex-nowrap"
        >
          {showName && (
            <span
              className="font-medium truncate min-w-0"
              style={{ maxWidth: barWidth < 560 ? "7rem" : "14rem" }}
              title={doc.filename}
            >
              {doc.filename}
            </span>
          )}

          <div className="shrink-0 flex items-center gap-0.5 rounded-lg border border-slate-200 px-0.5 py-0.5">
            <button
              onClick={() => setManualScale(+(scale - 0.1).toFixed(2))}
              className="px-2 py-0.5 rounded hover:bg-slate-100 text-slate-600"
              title="Zoom out"
              aria-label="Zoom out"
            >
              −
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitZoomText();
              }}
            >
              <input
                value={zoomText || `${Math.round(scale * 100)}%`}
                onChange={(e) => setZoomText(e.target.value)}
                onFocus={(e) => {
                  setZoomText(String(Math.round(scale * 100)));
                  requestAnimationFrame(() => e.target.select());
                }}
                onBlur={commitZoomText}
                title="Type a zoom level, for example 140"
                className="w-11 text-center text-xs rounded px-1 py-0.5 bg-transparent hover:bg-slate-100 focus:bg-white focus:outline-none"
                style={{ color: "var(--text-secondary)" }}
                data-testid="zoom-input"
              />
            </form>
            <button
              onClick={() => setManualScale(+(scale + 0.1).toFixed(2))}
              className="px-2 py-0.5 rounded hover:bg-slate-100 text-slate-600"
              title="Zoom in"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => setFitWidth(true)}
              title="Fit the page to the width of this pane, and keep it fitted as the pane resizes"
              className="ml-0.5 rounded-md px-2 py-0.5 text-[11px] font-medium"
              style={
                fitWidth
                  ? { background: "var(--text)", color: "var(--bg)" }
                  : { color: "var(--text-secondary)" }
              }
              data-testid="zoom-fit"
            >
              Fit
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = parseInt(pageInput, 10);
              if (n >= 1 && n <= doc.pageCount) scrollToPage(n);
            }}
            className={`shrink-0 items-center gap-1 text-xs text-slate-500 ${showPages ? "flex" : "hidden"}`}
          >
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              placeholder="p."
              aria-label="Go to page"
              className="w-11 border border-slate-200 rounded px-1.5 py-0.5"
            />
            <span className="whitespace-nowrap">of {doc.pageCount}</span>
          </form>

          {quality.length > 0 && (
            <div className="shrink-0 relative">
              <button
                onClick={() => setQualityOpen((v) => !v)}
                aria-expanded={qualityOpen}
                title="How reliable the text of this document is"
                className={`flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 ${chipLabel ? "px-2.5" : "px-1.5"}`}
                aria-label="Text quality of this document"
                data-testid="text-quality"
              >
                <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {chipLabel && "Text quality"}
              </button>
              {qualityOpen && (
                <div
                  className="absolute left-0 top-9 z-40 w-72 max-w-[min(18rem,80vw)] rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xl"
                  data-testid="text-quality-note"
                >
                  <p className="font-semibold mb-1.5 text-slate-700">About this document&apos;s text</p>
                  <ul className="space-y-1.5 text-slate-600 list-disc pl-4">
                    {quality.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                  <Link
                    href={`/matters/${matterId}/documents`}
                    className="mt-2.5 inline-block underline text-slate-500 hover:text-slate-800"
                  >
                    Documents, where OCR can be run again
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className={`relative ml-auto shrink-0 ${showSearch ? "" : "hidden"}`}>
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Find in document…"
              className="w-48 border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400"
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
                linkedCardIds={linkedCardIds}
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
          kind={kind}
        />
      )}

      {/* right card panel; the desk owns this when panes are side by side */}
      {!compact && (
      <CardPanel
        cards={cards}
        selectedCardId={selectedCardId}
        onSelect={jumpToCard}
        onChanged={refreshCards}
      />
      )}
    </div>
  );
}

const TAGS_KEY = "mos.reader.tagsOpen";

function HighlightPopover({
  pending,
  onSave,
  onDismiss,
  kind,
}: {
  pending: PendingHighlight;
  onSave: (type: CardTypeValue, note: string, eventDate: string | null) => Promise<void>;
  onDismiss: () => void;
  kind: MatterKind;
}) {
  const [note, setNote] = useState("");
  // a case opens it, a project does not, and a hand made choice outranks both
  const [tagsOpen, setTagsOpen] = useState(kind === "CASE");
  useEffect(() => {
    const stored = localStorage.getItem(TAGS_KEY);
    if (stored !== null) setTagsOpen(stored === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem(TAGS_KEY, tagsOpen ? "1" : "0");
  }, [tagsOpen]);
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
      {/*
        The same fold the clipper uses. Nine legal categories as the first
        thing anyone sees is right for a lawyer and wrong for everyone else,
        who is being asked whether the sentence they just read is an
        Admission. A case opens it by default, a project does not, and either
        way the choice is remembered once it is made by hand.
      */}
      <div className="flex items-center gap-2">
        <button
          disabled={busy || askDate}
          onClick={() => pick("MISC")}
          className="flex-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          data-testid="popover-save"
        >
          Save note
        </button>
        <button
          type="button"
          onClick={() => setTagsOpen((v) => !v)}
          aria-expanded={tagsOpen}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900"
          data-testid="popover-tags"
        >
          {kind === "CASE" ? "Legal tags" : "Tags"} {tagsOpen ? "▴" : "▾"}
        </button>
      </div>
      {tagsOpen && (
        <div className="mt-2.5 border-t border-slate-100 pt-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
            Save it as
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CARD_TYPES.filter((t) => t !== "MISC").map((t) => (
              <button
                key={t}
                disabled={busy}
                onClick={() => pick(t)}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
                style={{
                  background: CARD_TYPE_COLOR[t],
                  opacity: askDate && t !== "DATE" ? 0.35 : 1,
                }}
                data-testid={`chip-${t}`}
              >
                {cardTypeLabel(t, kind)}
              </button>
            ))}
          </div>
        </div>
      )}
      <button onClick={onDismiss} className="mt-2 text-xs text-slate-400 hover:text-slate-600">
        Dismiss
      </button>
    </div>
  );
}

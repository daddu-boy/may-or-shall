"use client";

import { memo, useEffect, useRef, useState } from "react";
import { TextLayer } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { CardDto } from "@/lib/clientTypes";
import { CARD_TYPE_COLOR } from "@/lib/labels";

/**
 * One page of the continuous-scroll reader. The canvas + text layer render
 * lazily when the page nears the viewport and are torn down when it scrolls
 * far away, so a 500-page PDF stays responsive (PRD F2 acceptance).
 */
function PdfPage({
  pdf,
  pageNumber,
  scale,
  width,
  height,
  cards,
  selectedCardId,
  onSelectCard,
  onSize,
  registerRef,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  width: number;
  height: number;
  cards: CardDto[];
  selectedCardId: string | null;
  onSelectCard: (id: string) => void;
  onSize: (page: number, w: number, h: number) => void;
  registerRef: (page: number, el: HTMLDivElement | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "1200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) {
      // tear down offscreen pages to cap memory
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
      if (textRef.current) textRef.current.innerHTML = "";
      setRendered(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        onSize(pageNumber, viewport.width / scale, viewport.height / scale);

        const canvas = canvasRef.current;
        const textDiv = textRef.current;
        if (!canvas || !textDiv) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({
          canvas,
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        }).promise;
        if (cancelled) return;

        textDiv.innerHTML = "";
        textDiv.style.setProperty("--scale-factor", String(scale));
        textDiv.style.setProperty("--total-scale-factor", String(scale));
        const textLayer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container: textDiv,
          viewport,
        });
        await textLayer.render();
        if (!cancelled) setRendered(true);
      } catch (e) {
        if (!(e instanceof Error && e.name === "RenderingCancelledException")) {
          console.error(`Failed to render page ${pageNumber}`, e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, pdf, pageNumber, scale, onSize]);

  return (
    <div
      ref={(el) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        registerRef(pageNumber, el);
      }}
      data-pdf-page={pageNumber}
      className="relative bg-white shadow-sm"
      style={{ width: width * scale, height: height * scale }}
    >
      {!rendered && (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-300">
          {pageNumber}
        </span>
      )}
      <canvas ref={canvasRef} className="absolute inset-0" />
      {/* persistent highlights, colour-keyed to card type */}
      <div className="absolute inset-0 pointer-events-none">
        {cards.flatMap((card) =>
          card.rects
            .filter((r) => r.page === pageNumber)
            .map((r, i) => (
              <div
                key={`${card.id}-${i}`}
                data-testid="highlight-rect"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCard(card.id);
                }}
                className="absolute pointer-events-auto cursor-pointer"
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                  background: CARD_TYPE_COLOR[card.cardType],
                  opacity: card.id === selectedCardId ? 0.5 : 0.3,
                  mixBlendMode: "multiply",
                }}
              />
            ))
        )}
      </div>
      <div ref={textRef} className="textLayer" />
    </div>
  );
}

export default memo(PdfPage);

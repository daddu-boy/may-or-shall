"use client";

import { useState } from "react";
import type { MatterKind } from "@/lib/labels";
import Board from "./board/Board";
import LinksView from "./links/LinksView";

/**
 * The cards area has two views of the same material: the board of individual
 * passages, and the links between them. Links are reasoning rather than
 * capture, so they get their own place rather than being buried inside a card.
 */
export default function CardsWorkspace({
  matterId,
  initialCardId,
  initialTab,
  kind = "CASE",
}: {
  matterId: string;
  initialCardId?: string;
  initialTab?: string;
  kind?: MatterKind;
}) {
  const [tab, setTab] = useState<"cards" | "links">(initialTab === "links" ? "links" : "cards");

  const tabButton = (id: "cards" | "links", label: string) => (
    <button
      onClick={() => setTab(id)}
      className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors"
      style={
        tab === id
          ? { background: "var(--text)", color: "var(--bg)" }
          : { color: "var(--text-secondary)" }
      }
    >
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col">
      <div
        className="h-12 shrink-0 flex items-center gap-1 px-4"
        style={{ borderBottom: "1px solid var(--hairline)", background: "var(--surface)" }}
      >
        {tabButton("cards", "Cards")}
        {tabButton("links", "Links")}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "cards" ? (
          <Board matterId={matterId} initialCardId={initialCardId} kind={kind} />
        ) : (
          <LinksView matterId={matterId} />
        )}
      </div>
    </div>
  );
}

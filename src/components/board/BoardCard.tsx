"use client";

import { memo } from "react";
import type { CardDto } from "@/lib/clientTypes";
import { CARD_TYPE_COLOR, CARD_TYPE_LABEL } from "@/lib/labels";

function BoardCard({
  card,
  selected,
  onOpen,
  onToggleSelect,
  onDragStart,
  onDropOn,
}: {
  card: CardDto;
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onDragStart: () => void;
  onDropOn: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropOn();
      }}
      onClick={onOpen}
      data-testid="board-card"
      className={`group rounded-md border bg-white p-2.5 cursor-pointer text-sm shadow-sm hover:shadow ${
        selected ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleSelect}
          className={`${selected ? "" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
        />
        <span
          className="text-[10px] font-semibold text-white rounded-full px-2 py-0.5"
          style={{ background: CARD_TYPE_COLOR[card.cardType] }}
        >
          {CARD_TYPE_LABEL[card.cardType]}
        </span>
        {card.pinned && <span title="Pinned">📌</span>}
        {card.eventDate && (
          <span className="text-[10px] text-amber-700">{card.eventDate.slice(0, 10)}</span>
        )}
      </div>
      <p className="text-xs text-slate-700 line-clamp-3">{card.body || card.quote}</p>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        {/* source chip: document short name, page, para (PRD F3 acceptance) */}
        {card.document && (
          <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
            {card.document.filename.replace(/\.pdf$/i, "").slice(0, 24)}
            {card.page ? ` · p.${card.page}` : ""}
            {card.para ? ` ¶${card.para}` : ""}
          </span>
        )}
        {!card.document && card.sourceUrl && (
          <a
            href={card.sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-blue-500 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 hover:underline"
            title={card.sourceTitle ?? card.sourceUrl}
          >
            🌐 {new URL(card.sourceUrl).hostname.replace(/^www\./, "")}
          </a>
        )}
        {card.tags.map((t) => (
          <span key={t} className="text-[10px] text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export default memo(BoardCard);

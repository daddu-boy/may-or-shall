"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, type CardDto } from "@/lib/clientTypes";
import { CARD_TYPES, CARD_TYPE_COLOR, CARD_TYPE_LABEL } from "@/lib/labels";

/** Right panel of the reader: all cards for the open document in page order (PRD F2). */
export default function CardPanel({
  cards,
  selectedCardId,
  onSelect,
  onChanged,
}: {
  cards: CardDto[];
  selectedCardId: string | null;
  onSelect: (card: CardDto) => void;
  onChanged: () => void;
}) {
  const sorted = useMemo(
    () =>
      [...cards].sort((a, b) => {
        if ((a.page ?? 0) !== (b.page ?? 0)) return (a.page ?? 0) - (b.page ?? 0);
        const ay = a.rects.length ? Math.min(...a.rects.map((r) => r.y)) : 0;
        const by = b.rects.length ? Math.min(...b.rects.map((r) => r.y)) : 0;
        return ay - by;
      }),
    [cards]
  );

  return (
    <aside className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col">
      <div className="h-11 shrink-0 border-b border-slate-100 flex items-center px-4">
        <h3 className="text-sm font-semibold">
          Cards <span className="text-slate-400 font-normal">({cards.length})</span>
        </h3>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2" data-testid="card-panel">
        {sorted.length === 0 && (
          <p className="text-xs text-slate-400 px-1">
            Select text in the document to create your first card.
          </p>
        )}
        {sorted.map((card) => (
          <PanelCard
            key={card.id}
            card={card}
            selected={card.id === selectedCardId}
            onSelect={() => onSelect(card)}
            onChanged={onChanged}
          />
        ))}
      </div>
    </aside>
  );
}

function PanelCard({
  card,
  selected,
  onSelect,
  onChanged,
}: {
  card: CardDto;
  selected: boolean;
  onSelect: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(card.body);
  const [para, setPara] = useState(card.para ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const save = async () => {
    await api(`/api/cards/${card.id}`, {
      method: "PATCH",
      body: JSON.stringify({ body, para: para || null }),
    });
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    if (!confirm("Delete this card?")) return;
    await api(`/api/cards/${card.id}`, { method: "DELETE" });
    onChanged();
  };

  return (
    <div
      ref={ref}
      onClick={onSelect}
      data-testid="panel-card"
      className={`rounded-lg border p-2.5 cursor-pointer text-sm transition-colors ${
        selected ? "border-slate-400 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[10px] font-semibold text-white rounded-full px-2 py-0.5"
          style={{ background: CARD_TYPE_COLOR[card.cardType] }}
        >
          {CARD_TYPE_LABEL[card.cardType]}
        </span>
        <span className="text-[10px] text-slate-400" data-testid="source-chip">
          p.{card.page}
          {card.para ? ` ¶${card.para}` : ""}
        </span>
        {card.eventDate && (
          <span className="text-[10px] text-amber-700">{card.eventDate.slice(0, 10)}</span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditing((v) => !v);
          }}
          className="ml-auto text-[10px] text-slate-400 hover:text-slate-700"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      {editing ? (
        <div onClick={(e) => e.stopPropagation()}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
          />
          <div className="flex items-center gap-2 mt-1">
            <input
              value={para}
              onChange={(e) => setPara(e.target.value)}
              placeholder="¶ no."
              className="w-16 border border-slate-200 rounded px-2 py-1 text-xs"
            />
            <select
              value={card.cardType}
              onChange={async (e) => {
                await api(`/api/cards/${card.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ cardType: e.target.value }),
                });
                onChanged();
              }}
              className="border border-slate-200 rounded px-1 py-1 text-xs"
            >
              {CARD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CARD_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <button onClick={save} className="text-xs bg-slate-900 text-white rounded px-2 py-1">
              Save
            </button>
            <button onClick={remove} className="text-xs text-red-500 ml-auto">
              Delete
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-700 line-clamp-3">{card.body || card.quote}</p>
      )}
    </div>
  );
}

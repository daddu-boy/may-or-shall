"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type CardDto, type DocumentDto } from "@/lib/clientTypes";
import { CARD_TYPES, CARD_TYPE_COLOR, CARD_TYPE_LABEL } from "@/lib/labels";
import CardDrawer from "./CardDrawer";
import BoardCard from "./BoardCard";

type GroupBy = "type" | "document" | "tag" | "date";

export default function Board({
  matterId,
  initialCardId,
}: {
  matterId: string;
  initialCardId?: string;
}) {
  const [cards, setCards] = useState<CardDto[]>([]);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>("type");
  const [filterType, setFilterType] = useState<string>("");
  const [filterDoc, setFilterDoc] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [filterText, setFilterText] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [drawerCardId, setDrawerCardId] = useState<string | null>(initialCardId ?? null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, d] = await Promise.all([
      api<CardDto[]>(`/api/matters/${matterId}/cards`),
      api<DocumentDto[]>(`/api/matters/${matterId}/documents`),
    ]);
    setCards(c);
    setDocs(d);
  }, [matterId]);

  useEffect(() => {
    load();
  }, [load]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    cards.forEach((c) => c.tags.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [cards]);

  const filtered = useMemo(
    () =>
      cards.filter((c) => {
        if (filterType && c.cardType !== filterType) return false;
        if (filterDoc && c.documentId !== filterDoc) return false;
        if (filterTag && !c.tags.includes(filterTag)) return false;
        if (filterText) {
          const t = filterText.toLowerCase();
          if (
            !c.body.toLowerCase().includes(t) &&
            !c.quote.toLowerCase().includes(t) &&
            !(c.citation ?? "").toLowerCase().includes(t)
          )
            return false;
        }
        if (filterFrom && (!c.eventDate || c.eventDate.slice(0, 10) < filterFrom)) return false;
        if (filterTo && (!c.eventDate || c.eventDate.slice(0, 10) > filterTo)) return false;
        return true;
      }),
    [cards, filterType, filterDoc, filterTag, filterText, filterFrom, filterTo]
  );

  const columns = useMemo((): { key: string; title: string; color?: string; cards: CardDto[] }[] => {
    const sortCol = (list: CardDto[]) => [...list].sort((a, b) => a.orderIndex - b.orderIndex);
    if (groupBy === "type") {
      return CARD_TYPES.map((t) => ({
        key: t,
        title: CARD_TYPE_LABEL[t],
        color: CARD_TYPE_COLOR[t],
        cards: sortCol(filtered.filter((c) => c.cardType === t)),
      })).filter((col) => col.cards.length > 0 || !filterType);
    }
    if (groupBy === "document") {
      const cols = docs.map((d) => ({
        key: d.id,
        title: d.filename,
        cards: sortCol(filtered.filter((c) => c.documentId === d.id)),
      }));
      const unlinked = sortCol(filtered.filter((c) => !c.documentId));
      if (unlinked.length) cols.push({ key: "__none", title: "No document", cards: unlinked });
      return cols;
    }
    if (groupBy === "tag") {
      // "Issues" view: cards tagged with an issue name cluster together (PRD F3).
      const cols = allTags.map((t) => ({
        key: t,
        title: t,
        cards: sortCol(filtered.filter((c) => c.tags.includes(t))),
      }));
      const untagged = sortCol(filtered.filter((c) => c.tags.length === 0));
      if (untagged.length) cols.push({ key: "__untagged", title: "Untagged", cards: untagged });
      return cols;
    }
    // date: one column per month
    const byMonth = new Map<string, CardDto[]>();
    const dated = filtered.filter((c) => c.eventDate);
    dated.sort((a, b) => a.eventDate!.localeCompare(b.eventDate!));
    for (const c of dated) {
      const key = c.eventDate!.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(c);
    }
    const cols = [...byMonth.entries()].map(([key, list]) => ({ key, title: key, cards: list }));
    const undated = filtered.filter((c) => !c.eventDate);
    if (undated.length) cols.push({ key: "__nodate", title: "No date", cards: undated });
    return cols;
  }, [filtered, groupBy, docs, allTags, filterType]);

  /** Reorder within a column by dropping onto a target card (order persists via orderIndex). */
  const dropOn = async (target: CardDto, column: CardDto[]) => {
    if (!dragId || dragId === target.id) return;
    const dragged = cards.find((c) => c.id === dragId);
    if (!dragged) return;
    const idx = column.findIndex((c) => c.id === target.id);
    const prev = column[idx - 1];
    const newIndex =
      idx === 0 ? target.orderIndex - 1 : (prev.orderIndex + target.orderIndex) / 2;
    setCards((cs) => cs.map((c) => (c.id === dragId ? { ...c, orderIndex: newIndex } : c)));
    setDragId(null);
    await api(`/api/cards/${dragId}`, {
      method: "PATCH",
      body: JSON.stringify({ orderIndex: newIndex }),
    });
    load();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyTag = async () => {
    const tag = prompt("Tag to apply to selected cards (e.g. an issue name):");
    if (!tag?.trim()) return;
    await Promise.all(
      [...selectedIds].map((id) => {
        const card = cards.find((c) => c.id === id);
        if (!card || card.tags.includes(tag)) return null;
        return api(`/api/cards/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ tags: [...card.tags, tag.trim()] }),
        });
      })
    );
    setSelectedIds(new Set());
    load();
  };

  const select = "border border-slate-200 rounded px-2 py-1 text-xs bg-white";

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2 flex items-center gap-2 flex-wrap text-xs">
        <label className="text-slate-500">Group by</label>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className={select}>
          <option value="type">Card type</option>
          <option value="document">Document</option>
          <option value="tag">Tag / issue</option>
          <option value="date">Date</option>
        </select>
        <span className="text-slate-200 mx-1">|</span>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={select}>
          <option value="">All types</option>
          {CARD_TYPES.map((t) => (
            <option key={t} value={t}>
              {CARD_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select value={filterDoc} onChange={(e) => setFilterDoc(e.target.value)} className={select}>
          <option value="">All documents</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.filename}
            </option>
          ))}
        </select>
        <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className={select}>
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Search cards…"
          className={`${select} w-40`}
        />
        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className={select} />
        <span className="text-slate-400">–</span>
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className={select} />
        {selectedIds.size > 0 && (
          <button
            onClick={applyTag}
            className="ml-auto rounded bg-slate-900 text-white px-3 py-1.5 font-medium"
          >
            Tag {selectedIds.size} selected
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="flex gap-3 p-4 min-h-full items-start">
          {columns.map((col) => (
            <div key={col.key} className="w-72 shrink-0 rounded-lg bg-slate-100 border border-slate-200">
              <div className="px-3 py-2 flex items-center gap-2 sticky top-0">
                {col.color && (
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                )}
                <span className="text-xs font-semibold truncate">{col.title}</span>
                <span className="text-xs text-slate-400 ml-auto">{col.cards.length}</span>
              </div>
              <div className="px-2 pb-2 space-y-2 max-h-[calc(100vh-160px)] overflow-auto">
                {col.cards.map((card) => (
                  <BoardCard
                    key={card.id}
                    card={card}
                    selected={selectedIds.has(card.id)}
                    onOpen={() => setDrawerCardId(card.id)}
                    onToggleSelect={() => toggleSelect(card.id)}
                    onDragStart={() => setDragId(card.id)}
                    onDropOn={() => dropOn(card, col.cards)}
                  />
                ))}
              </div>
            </div>
          ))}
          {columns.length === 0 && (
            <p className="text-sm text-slate-400 p-4">No cards match the current filters.</p>
          )}
        </div>
      </div>

      {drawerCardId && (
        <CardDrawer
          cardId={drawerCardId}
          matterId={matterId}
          onClose={() => setDrawerCardId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

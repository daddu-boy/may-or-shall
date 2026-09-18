"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type CardDto, type CategoryDto, type DocumentDto } from "@/lib/clientTypes";
import {
  CARD_TYPES,
  CARD_TYPE_COLOR,
  cardTypeLabel,
  type MatterKind,
} from "@/lib/labels";
import { refreshCardTypes, useCardTypes } from "@/lib/useCardTypes";
import NewCardComposer from "./NewCardComposer";
import CardDrawer from "./CardDrawer";
import BoardCard from "./BoardCard";

type GroupBy = "type" | "document" | "tag" | "date";

export default function Board({
  matterId,
  initialCardId,
  kind = "CASE",
}: {
  matterId: string;
  initialCardId?: string;
  kind?: MatterKind;
}) {
  const { categories } = useCardTypes();
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
  const [composing, setComposing] = useState(false);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState("");

  /*
   * A note you cannot write down quickly is a note you do not write down. "n"
   * opens the composer, unless you are already typing somewhere.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (el?.isContentEditable) return;
      e.preventDefault();
      setComposing(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const load = useCallback(async () => {
    const [c, d] = await Promise.all([
      api<CardDto[]>(`/api/matters/${matterId}/cards`),
      api<DocumentDto[]>(`/api/matters/${matterId}/documents`),
    ]);
    setCards(c);
    setDocs(d);
  }, [matterId]);

  /*
   * The ten built in types are a litigator's vocabulary. Anyone filing by
   * Compliance, Costs or Witness needs their own, so a category is a row in
   * the account and behaves exactly like a built in everywhere else.
   */
  const addCategory = async (label: string) => {
    setCategoryError("");
    try {
      await api<CategoryDto>("/api/card-types", {
        method: "POST",
        body: JSON.stringify({ label }),
      });
      await refreshCardTypes();
      setNewCategory(null);
    } catch (e) {
      setCategoryError((e as Error).message);
    }
  };

  const removeCategory = async (cat: CategoryDto) => {
    const n = cards.filter((c) => c.cardType === cat.key).length;
    if (
      !confirm(
        `Delete the "${cat.label}" category?` +
          (n ? `\n\n${n} card${n === 1 ? "" : "s"} filed under it in this matter will become Personal notes. Nothing is deleted.` : "")
      )
    )
      return;
    await api(`/api/card-types/${cat.id}`, { method: "DELETE" });
    if (filterType === cat.key) setFilterType("");
    await refreshCardTypes();
    await load();
  };

  /** Every type this account can file under, built in first, then its own. */
  const allTypes = useMemo(
    () => [
      ...CARD_TYPES.map((t) => ({ key: t as string, label: cardTypeLabel(t, kind), color: CARD_TYPE_COLOR[t], custom: null as CategoryDto | null })),
      ...categories.map((c) => ({ key: c.key, label: c.label, color: c.color, custom: c })),
    ],
    [categories, kind]
  );

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
      return allTypes
        .map((t) => ({
          key: t.key,
          title: t.label,
          color: t.color,
          cards: sortCol(filtered.filter((c) => c.cardType === t.key)),
        }))
        .filter((col) => col.cards.length > 0 || !filterType);
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
  }, [filtered, groupBy, docs, allTags, filterType, allTypes]);

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

  /**
   * Delete everything selected.
   *
   * A card is not only a card: a Date card owns its row in the List of Dates,
   * and a link between two cards cannot outlive either end. Both cascade in the
   * database, so the confirmation says so rather than letting a chronology
   * quietly lose entries.
   */
  const removeSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const dated = ids.filter((id) => cards.find((c) => c.id === id)?.eventDate).length;
    const ok = window.confirm(
      `Delete ${ids.length} card${ids.length === 1 ? "" : "s"} permanently?\n\n` +
        (dated > 0
          ? `${dated} of them carr${dated === 1 ? "ies a date, and its" : "y dates, and their"} ` +
            `List of Dates entr${dated === 1 ? "y" : "ies"} will go too.\n`
          : "") +
        `Any links to or from them will also go. This cannot be undone.`
    );
    if (!ok) return;

    const results = await Promise.allSettled(
      ids.map((id) => api(`/api/cards/${id}`, { method: "DELETE" }))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds(new Set());
    await load();
    // say so rather than leaving cards on the board with no explanation
    if (failed > 0) {
      window.alert(
        `${ids.length - failed} deleted. ${failed} could not be deleted and are still on the board.`
      );
    }
  };

  const selectAllShown = () => setSelectedIds(new Set(filtered.map((c) => c.id)));

  const select = "border border-slate-200 rounded px-2 py-1 text-xs bg-white";

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2 flex items-center gap-2 flex-wrap text-xs">
        <button
          onClick={() => setComposing((v) => !v)}
          className="rounded-full bg-slate-900 px-3.5 py-1.5 font-semibold text-white"
          title="Write a note by hand (n)"
          data-testid="new-card"
        >
          + New note
        </button>
        <span className="mx-1 text-slate-200">|</span>
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
          {allTypes.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        {newCategory === null ? (
          <button
            onClick={() => { setNewCategory(""); setCategoryError(""); }}
            className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-600 hover:border-slate-500 hover:text-slate-900"
            title="Add a card category of your own, beside Fact, Date and the rest"
            data-testid="new-category"
          >
            + Category
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newCategory.trim()) addCategory(newCategory.trim());
            }}
            className="flex items-center gap-1.5"
          >
            <input
              autoFocus
              value={newCategory}
              maxLength={24}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setNewCategory(null); }}
              placeholder="Category name, e.g. Compliance"
              className="rounded border border-slate-300 px-2 py-1 text-xs w-52"
              data-testid="new-category-name"
            />
            <button type="submit" className="rounded-full bg-slate-900 px-3 py-1.5 font-semibold text-white">
              Add
            </button>
            <button type="button" onClick={() => setNewCategory(null)} className="text-slate-500 hover:text-slate-900">
              Cancel
            </button>
          </form>
        )}
        {categoryError && <span className="text-red-600">{categoryError}</span>}
        {categories.length > 0 && newCategory === null && (
          <span className="flex items-center gap-1.5">
            {categories.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-white"
                style={{ background: c.color }}
              >
                {c.label}
                <button
                  onClick={() => removeCategory(c)}
                  title={`Delete the ${c.label} category`}
                  aria-label={`Delete the ${c.label} category`}
                  className="opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
          </span>
        )}
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
        <button
          onClick={selectAllShown}
          className="text-slate-500 hover:text-slate-900"
          title="Select every card currently shown"
          data-testid="select-all"
        >
          Select all{filtered.length ? ` (${filtered.length})` : ""}
        </button>
        {selectedIds.size > 0 && (
          <>
            <span className="text-slate-400">{selectedIds.size} selected</span>
            <button
              onClick={applyTag}
              className="rounded bg-slate-900 text-white px-3 py-1.5 font-medium"
            >
              Tag
            </button>
            <button
              onClick={removeSelected}
              className="rounded border border-red-200 px-3 py-1.5 font-medium text-red-600 hover:bg-red-50"
              data-testid="delete-selected"
            >
              Delete {selectedIds.size}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-500 hover:text-slate-900"
              data-testid="clear-selection"
            >
              Clear
            </button>
          </>
        )}
        {/* every card, with its quote and source, as one document */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-slate-400">Download all:</span>
          <a
            href={`/api/matters/${matterId}/exports/cards`}
            className="rounded border border-slate-200 px-2.5 py-1.5 font-medium hover:bg-slate-50"
          >
            Word
          </a>
          <a
            href={`/api/matters/${matterId}/exports/cards?format=pdf`}
            className="rounded border border-slate-200 px-2.5 py-1.5 font-medium hover:bg-slate-50"
          >
            PDF
          </a>
        </div>
      </div>

      {composing && (
        <NewCardComposer
          matterId={matterId}
          documents={docs}
          kind={kind}
          onSaved={(card) => setCards((prev) => [...prev, card])}
          onClose={() => setComposing(false)}
        />
      )}

      <div className="flex-1 overflow-auto">
        <div className="flex gap-3 p-4 min-h-full items-start">
          {columns.map((col) => (
            <div key={col.key} className="w-72 shrink-0 rounded-lg bg-slate-100 border border-slate-200">
              {/*
                Opaque and above the cards. It was sticky with no background,
                so a card scrolling past showed straight through the heading and
                the two lines of text sat on top of each other.
              */}
              <div className="px-3 py-2 flex items-center gap-2 sticky top-0 z-10 rounded-t-lg border-b border-slate-200 bg-slate-100">
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
                    onChanged={load}
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

"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Office.js globals are untyped at runtime */

import { useCallback, useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { api, type CardDto, type MatterDto } from "@/lib/clientTypes";
import { CARD_TYPES, CARD_TYPE_COLOR, CARD_TYPE_LABEL } from "@/lib/labels";

/* Office.js globals (loaded from the CDN at runtime inside Word). */
declare const Office: any;
declare const Word: any;

/**
 * The Word add-in "plotter" (two-step composition, decided 2026-07-08):
 * browse the matter's card base beside the draft and plot selected cards into
 * the document as labelled, source-chipped content controls. Any AI add-in
 * (Claude, Copilot) can then read the plotted material straight off the page —
 * the document is the channel between add-ins.
 */
export default function TaskPane() {
  const [inWord, setInWord] = useState(false);
  const [officeReady, setOfficeReady] = useState(false);
  const [matters, setMatters] = useState<MatterDto[]>([]);
  const [matterId, setMatterId] = useState("");
  const [cards, setCards] = useState<CardDto[]>([]);
  const [filterType, setFilterType] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [withHeading, setWithHeading] = useState(false);
  const [status, setStatus] = useState("");

  const loadMatters = useCallback(async (selectId?: string) => {
    const list = await api<MatterDto[]>("/api/matters");
    const active = list.filter((m) => m.status === "ACTIVE");
    setMatters(active);
    if (selectId) setMatterId(selectId);
    else if (active.length > 0) setMatterId((cur) => cur || active[0].id);
  }, []);

  useEffect(() => {
    loadMatters();
  }, [loadMatters]);

  const createMatter = async () => {
    const title = window.prompt("New matter title:");
    if (!title?.trim()) return;
    try {
      const matter = await api<MatterDto>("/api/matters", {
        method: "POST",
        body: JSON.stringify({ title: title.trim() }),
      });
      await loadMatters(matter.id);
      setStatus(`Matter "${matter.title}" created.`);
    } catch (e) {
      setStatus(`Could not create matter: ${(e as Error).message}`);
    }
  };

  const loadCards = useCallback(async () => {
    if (!matterId) return;
    setCards(await api<CardDto[]>(`/api/matters/${matterId}/cards`));
    setSelected(new Set());
  }, [matterId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const onOfficeLoaded = () => {
    if (typeof Office === "undefined") return;
    Office.onReady((info: { host: string }) => {
      setOfficeReady(true);
      setInWord(String(info.host).toLowerCase().includes("word"));
    });
  };

  const visible = useMemo(
    () =>
      cards.filter((c) => {
        if (filterType && c.cardType !== filterType) return false;
        if (query) {
          const q = query.toLowerCase();
          if (
            !c.body.toLowerCase().includes(q) &&
            !c.quote.toLowerCase().includes(q) &&
            !c.tags.some((t) => t.toLowerCase().includes(q))
          )
            return false;
        }
        return true;
      }),
    [cards, filterType, query]
  );

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chipText = (card: CardDto): string => {
    if (card.document) {
      const bits = [card.document.filename.replace(/\.pdf$/i, "")];
      if (card.page) bits.push(`p.${card.page}`);
      if (card.para) bits.push(`¶${card.para}`);
      return `(${bits.join(", ")})`;
    }
    if (card.sourceUrl) {
      return `(${card.sourceTitle ? `${card.sourceTitle}, ` : ""}${card.sourceUrl})`;
    }
    return "";
  };

  /** The plot format is the contract: label + body + quote + source chip. */
  const cardHtml = (card: CardDto): string => {
    const color = CARD_TYPE_COLOR[card.cardType];
    const label = `[${CARD_TYPE_LABEL[card.cardType].toUpperCase()}]`;
    const body = escapeHtml(card.body || card.quote);
    const quote =
      card.quote && card.quote !== card.body
        ? ` — <i>&ldquo;${escapeHtml(card.quote)}&rdquo;</i>`
        : "";
    const chip = chipText(card);
    const chipHtml = chip
      ? ` <span style="color:#64748b">${escapeHtml(chip)}</span>`
      : "";
    return `<p style="font-family:'Times New Roman',serif;font-size:12pt"><b style="color:${color}">${label}</b> ${body}${quote}${chipHtml}</p>`;
  };

  const plainText = (card: CardDto): string => {
    const label = `[${CARD_TYPE_LABEL[card.cardType].toUpperCase()}]`;
    const quote = card.quote && card.quote !== card.body ? ` — "${card.quote}"` : "";
    return `${label} ${card.body || card.quote}${quote} ${chipText(card)}`.trim();
  };

  const orderedSelection = () => visible.filter((c) => selected.has(c.id));

  const insertIntoWord = async (toInsert: CardDto[]) => {
    if (toInsert.length === 0) return;
    setStatus("Inserting…");
    try {
      await Word.run(async (context: any) => {
        const selection = context.document.getSelection();
        let anchor = selection.insertParagraph("", "After");
        if (withHeading && toInsert.length > 1) {
          const matter = matters.find((m) => m.id === matterId);
          anchor.insertHtml(
            `<p style="font-family:'Times New Roman',serif;font-size:12pt"><b>MATERIALS — ${escapeHtml(
              matter?.title ?? "May or Shall"
            )}</b></p>`,
            "Replace"
          );
          anchor = anchor.insertParagraph("", "After");
        }
        for (let i = 0; i < toInsert.length; i++) {
          const card = toInsert[i];
          const cc = anchor.insertContentControl();
          cc.tag = `mayorshall:card:${card.id}`;
          cc.title = `${CARD_TYPE_LABEL[card.cardType]} ${chipText(card)}`.slice(0, 250);
          cc.insertHtml(cardHtml(card), "Replace");
          if (i < toInsert.length - 1) {
            anchor = cc.getRange("After").insertParagraph("", "After");
          }
        }
        await context.sync();
      });
      setStatus(`Inserted ${toInsert.length} card${toInsert.length === 1 ? "" : "s"}.`);
      setSelected(new Set());
    } catch (e) {
      setStatus(`Insert failed: ${(e as Error).message}`);
    }
  };

  const copyFallback = async (toInsert: CardDto[]) => {
    await navigator.clipboard.writeText(toInsert.map(plainText).join("\n\n"));
    setStatus(`Copied ${toInsert.length} card${toInsert.length === 1 ? "" : "s"} as text.`);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col text-sm">
      <Script
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
        strategy="afterInteractive"
        onLoad={onOfficeLoaded}
      />

      <header className="px-3 pt-3 pb-2 border-b border-slate-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600" />
          <h1 className="font-semibold">May or Shall</h1>
          <span
            className={`ml-auto text-[10px] rounded-full px-2 py-0.5 ${
              inWord ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
            data-testid="host-badge"
          >
            {inWord ? "Word connected" : officeReady ? "Not in Word — copy mode" : "Browser preview"}
          </span>
        </div>
        <select
          value={matterId}
          onChange={(e) => {
            if (e.target.value === "__new__") {
              createMatter();
              return;
            }
            setMatterId(e.target.value);
          }}
          className="w-full border border-slate-200 rounded px-2 py-1.5 mb-2"
          data-testid="addin-matter"
        >
          {matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
          <option value="__new__">＋ New matter…</option>
        </select>
        <div className="flex gap-1.5">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-200 rounded px-1.5 py-1 text-xs"
          >
            <option value="">All types</option>
            {CARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {CARD_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards…"
            className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs"
          />
        </div>
      </header>

      <div className="flex-1 overflow-auto px-3 py-2 space-y-1.5" data-testid="addin-cards">
        {visible.map((card) => (
          <label
            key={card.id}
            className={`flex gap-2 items-start rounded-md border p-2 cursor-pointer ${
              selected.has(card.id) ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200"
            }`}
            data-testid="addin-card"
          >
            <input
              type="checkbox"
              checked={selected.has(card.id)}
              onChange={() => toggle(card.id)}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[9px] font-semibold text-white rounded-full px-1.5 py-0.5"
                  style={{ background: CARD_TYPE_COLOR[card.cardType] }}
                >
                  {CARD_TYPE_LABEL[card.cardType]}
                </span>
                <span className="text-[10px] text-slate-400 truncate">{chipText(card)}</span>
              </div>
              <p className="text-xs text-slate-700 mt-1 line-clamp-3">{card.body || card.quote}</p>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                if (inWord) insertIntoWord([card]);
                else copyFallback([card]);
              }}
              className="text-[10px] shrink-0 rounded border border-slate-200 px-1.5 py-1 text-slate-500 hover:bg-slate-50"
              title={inWord ? "Insert at cursor" : "Copy as text"}
            >
              {inWord ? "Insert" : "Copy"}
            </button>
          </label>
        ))}
        {visible.length === 0 && (
          <p className="text-xs text-slate-400 py-4 text-center">No cards match.</p>
        )}
      </div>

      <footer className="px-3 py-2.5 border-t border-slate-100 sticky bottom-0 bg-white">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-2">
          <input
            type="checkbox"
            checked={withHeading}
            onChange={(e) => setWithHeading(e.target.checked)}
          />
          Add a &ldquo;MATERIALS&rdquo; heading above the block
        </label>
        <button
          disabled={selected.size === 0}
          onClick={() =>
            inWord ? insertIntoWord(orderedSelection()) : copyFallback(orderedSelection())
          }
          className="w-full rounded-md bg-slate-900 text-white py-2 text-sm font-medium disabled:opacity-40"
          data-testid="addin-insert"
        >
          {inWord
            ? `Plot ${selected.size || ""} selected into document`
            : `Copy ${selected.size || ""} selected as text`}
        </button>
        {status && <p className="text-[11px] text-slate-500 mt-1.5">{status}</p>}
      </footer>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

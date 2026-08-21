"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type CardDto, type DocumentDto } from "@/lib/clientTypes";
import {
  CARD_TYPE_COLOR,
  LINK_KINDS,
  LINK_KIND_LABEL,
  type CardTypeValue,
  type LinkKindValue,
} from "@/lib/labels";
import Reader from "./reader/Reader";

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
      <span>
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
      </span>
    );
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-10 shrink-0 border-b border-slate-200 bg-white flex items-center gap-3 px-4">
          {picker(leftId, setLeftId)}
          <span className="text-xs text-slate-400">
            Drag a highlight onto a highlight in the other pane to link them.
          </span>
          {flash && <span className="text-xs font-medium text-emerald-600">{flash}</span>}
        </div>
        <div className="flex-1 min-h-0 flex divide-x divide-slate-200">
          <div className="flex-1 min-w-0">
            {leftId && (
              <Reader
                key={leftId}
                matterId={matterId}
                docId={leftId}
                compact
                onLinkDrop={createLink}
                linkedCardIds={linkedCardIds}
                onCardsChanged={load}
              />
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="h-10 shrink-0 border-b border-slate-200 bg-white flex items-center px-4">
              {picker(rightId, setRightId)}
            </div>
            <div className="flex-1 min-h-0">
              {rightId && (
                <Reader
                  key={rightId}
                  matterId={matterId}
                  docId={rightId}
                  compact
                  onLinkDrop={createLink}
                  linkedCardIds={linkedCardIds}
                  onCardsChanged={load}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col">
        <div className="h-10 shrink-0 border-b border-slate-200 flex items-center px-4">
          <h2 className="text-sm font-medium">Links</h2>
          <span className="ml-auto text-xs text-slate-400">{links.length}</span>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {links.length === 0 && (
            <p className="text-xs text-slate-400">
              No links yet. Highlight a passage in each pane, then drag one onto the other.
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
      </aside>
    </div>
  );
}

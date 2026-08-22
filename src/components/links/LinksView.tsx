"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, type CardDto, type DocumentDto } from "@/lib/clientTypes";
import {
  CARD_TYPE_COLOR,
  CARD_TYPE_LABEL,
  LINK_KINDS,
  LINK_KIND_LABEL,
  LINK_KIND_INVERSE_LABEL,
  type CardTypeValue,
  type LinkKindValue,
} from "@/lib/labels";

interface LinkDto {
  id: string;
  fromCardId: string;
  toCardId: string;
  kind: LinkKindValue;
  note: string;
  suggested: boolean;
  createdAt: string;
}

/**
 * Every link in the matter, in one place. A link between two passages is a
 * piece of reasoning ("this admission answers that plea"), and reasoning is
 * worth nothing if it is only visible in the screen that made it. Your own
 * note leads, because the relation words are a rough class and the sentence
 * you wrote is the actual thought.
 */
export default function LinksView({ matterId }: { matterId: string }) {
  const [links, setLinks] = useState<LinkDto[]>([]);
  const [cards, setCards] = useState<CardDto[]>([]);
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [l, c, d] = await Promise.all([
      api<LinkDto[]>(`/api/matters/${matterId}/links`),
      api<CardDto[]>(`/api/matters/${matterId}/cards`),
      api<DocumentDto[]>(`/api/matters/${matterId}/documents`),
    ]);
    setLinks(l);
    setCards(c);
    setDocuments(d);
    setLoading(false);
  }, [matterId]);

  useEffect(() => {
    load();
  }, [load]);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const docById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents]);

  const patch = async (id: string, data: Record<string, unknown>) => {
    await api(`/api/links/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this link? The two cards stay, only the connection goes.")) return;
    await api(`/api/links/${id}`, { method: "DELETE" });
    load();
  };

  const passage = (cardId: string, relation: string) => {
    const c = cardById.get(cardId);
    if (!c) return <p className="text-sm text-slate-400">(card deleted)</p>;
    const doc = c.documentId ? docById.get(c.documentId) : null;
    const href = doc
      ? `/matters/${matterId}/documents/${doc.id}?card=${c.id}`
      : `/matters/${matterId}/cards?card=${c.id}`;
    return (
      <Link
        href={href}
        className="block rounded-xl p-3 transition-colors"
        style={{ background: "var(--surface-sunken)" }}
      >
        <span className="flex items-center gap-2 mb-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: CARD_TYPE_COLOR[c.cardType as CardTypeValue] }}
          />
          <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
            {CARD_TYPE_LABEL[c.cardType as CardTypeValue]}
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {relation}
          </span>
        </span>
        <span className="block text-[13.5px] leading-relaxed" style={{ color: "var(--text)" }}>
          {c.quote || c.body}
        </span>
        <span className="mt-1.5 block text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {doc
            ? `${doc.annexureLabel ? doc.annexureLabel + " · " : ""}${doc.filename}${
                c.page ? `, p.${c.page}` : ""
              }${c.para ? `, para ${c.para}` : ""}`
            : c.sourceTitle || c.sourceUrl || "no source recorded"}
        </span>
      </Link>
    );
  };

  if (loading) return <p className="p-8 text-sm text-slate-400">Loading links…</p>;

  if (links.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h2 className="text-lg font-semibold">No links yet</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          A link joins two passages: the paragraph of the plaint and the annexure it relies on, an
          admission and the document that contradicts it. Open two documents side by side, pick a
          card in each, and press Link these. Whatever you write about the connection will show up
          here.
        </p>
        <Link
          href={`/matters/${matterId}/compare`}
          className="btn-primary inline-block mt-6 px-5 py-2.5 text-[13.5px]"
        >
          Open two PDFs
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="text-[22px] font-semibold">Links</h2>
        <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {links.length} connection{links.length === 1 ? "" : "s"} in this matter
        </span>
      </div>

      <ul className="space-y-4">
        {links.map((l) => (
          <li key={l.id} className="surface p-5">
            {/* the note leads when there is one: it is the actual reasoning */}
            {editing === l.id ? (
              <div className="mb-4">
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder="Why are these two connected? For example: this admission answers the plea in para 7."
                  className="field w-full px-3 py-2 text-[14px]"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={async () => {
                      await patch(l.id, { note: draft });
                      setEditing(null);
                    }}
                    className="btn-primary px-4 py-1.5 text-xs"
                  >
                    Save note
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="btn-quiet px-4 py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : l.note ? (
              <button
                onClick={() => {
                  setEditing(l.id);
                  setDraft(l.note);
                }}
                className="block w-full text-left mb-4"
              >
                <p className="text-[15px] leading-relaxed font-medium">{l.note}</p>
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  Your note · click to edit
                </span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditing(l.id);
                  setDraft("");
                }}
                className="block mb-4 text-[13px]"
                style={{ color: "var(--accent)" }}
              >
                + Add your own note
              </button>
            )}

            {passage(l.fromCardId, "")}

            <div className="flex items-center gap-2 my-2 pl-3">
              <select
                value={l.kind}
                onChange={(e) => patch(l.id, { kind: e.target.value })}
                className="field px-2 py-1 text-[12px]"
              >
                {LINK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LINK_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              {l.suggested && (
                <span className="text-[11px]" style={{ color: "var(--accent)" }}>
                  suggested
                </span>
              )}
              <button
                onClick={() => remove(l.id)}
                className="ml-auto text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Remove
              </button>
            </div>

            {passage(l.toCardId, LINK_KIND_INVERSE_LABEL[l.kind])}
          </li>
        ))}
      </ul>
    </div>
  );
}

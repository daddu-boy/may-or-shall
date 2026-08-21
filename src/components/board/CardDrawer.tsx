"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type CardDto } from "@/lib/clientTypes";
import {
  CARD_TYPES,
  CARD_TYPE_LABEL,
  CARD_TYPE_COLOR,
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
  suggested: boolean;
}

/** Card detail drawer (PRD F3): edit everything, see the source excerpt, jump to source. */
export default function CardDrawer({
  cardId,
  matterId,
  onClose,
  onChanged,
}: {
  cardId: string;
  matterId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [card, setCard] = useState<CardDto | null>(null);
  const [body, setBody] = useState("");
  const [cardType, setCardType] = useState<CardTypeValue>("MISC");
  const [eventDate, setEventDate] = useState("");
  const [tags, setTags] = useState("");
  const [pinned, setPinned] = useState(false);
  const [citation, setCitation] = useState("");
  const [proposition, setProposition] = useState("");
  const [treatment, setTreatment] = useState("");
  /** links touching this card, with the card at the other end */
  const [links, setLinks] = useState<{ link: LinkDto; other: CardDto; outgoing: boolean }[]>([]);

  useEffect(() => {
    (async () => {
      const c = await api<CardDto>(`/api/cards/${cardId}`);
      setCard(c);
      setBody(c.body);
      setCardType(c.cardType);
      setEventDate(c.eventDate ? c.eventDate.slice(0, 10) : "");
      setTags(c.tags.join(", "));
      setPinned(c.pinned);
      setCitation(c.citation ?? "");
      setProposition(c.proposition ?? "");
      // A link is only worth drawing if you can see it from the card itself.
      const all = await api<LinkDto[]>(`/api/matters/${matterId}/links`);
      const mine = all.filter((l) => l.fromCardId === cardId || l.toCardId === cardId);
      if (mine.length) {
        const cards = await api<CardDto[]>(`/api/matters/${matterId}/cards`);
        const byId = new Map(cards.map((x) => [x.id, x]));
        setLinks(
          mine
            .map((l) => {
              const outgoing = l.fromCardId === cardId;
              const other = byId.get(outgoing ? l.toCardId : l.fromCardId);
              return other ? { link: l, other, outgoing } : null;
            })
            .filter(Boolean) as { link: LinkDto; other: CardDto; outgoing: boolean }[]
        );
      } else {
        setLinks([]);
      }
      setTreatment(c.treatment ?? "");
    })();
  }, [cardId]);

  if (!card) return null;

  const save = async () => {
    await api(`/api/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify({
        body,
        cardType,
        eventDate: cardType === "DATE" ? eventDate || null : null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        pinned,
        citation: citation || null,
        proposition: proposition || null,
        treatment: treatment || null,
      }),
    });
    onChanged();
    onClose();
  };

  const remove = async () => {
    if (!confirm("Delete this card?")) return;
    await api(`/api/cards/${cardId}`, { method: "DELETE" });
    onChanged();
    onClose();
  };

  const input = "w-full border border-slate-200 rounded px-2 py-1.5 text-sm";
  const label = "block text-xs font-medium text-slate-500 mt-3 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <div
        className="w-[28rem] h-full bg-white shadow-2xl p-5 overflow-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="card-drawer"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Card</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        {card.quote && (
          <blockquote className="mt-3 border-l-2 border-slate-200 pl-3 text-xs text-slate-500 italic">
            “{card.quote}”
          </blockquote>
        )}
        {!card.document && card.sourceUrl && (
          <a
            href={card.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 text-xs text-blue-600 hover:underline"
          >
            Open source → {card.sourceTitle ?? card.sourceUrl}
          </a>
        )}
        {card.document && card.page && (
          <Link
            href={`/matters/${matterId}/documents/${card.document.id}?card=${card.id}`}
            className="inline-block mt-2 text-xs text-blue-600 hover:underline"
          >
            Open source → {card.document.filename}, p.{card.page}
            {card.para ? ` ¶${card.para}` : ""}
          </Link>
        )}

        {links.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-500 mb-1.5">Linked passages</p>
            <ul className="space-y-1.5">
              {links.map(({ link, other, outgoing }) => (
                <li key={link.id}>
                  <Link
                    href={
                      other.document
                        ? `/matters/${matterId}/documents/${other.document.id}?card=${other.id}`
                        : `/matters/${matterId}/cards?card=${other.id}`
                    }
                    className="block rounded-lg border border-slate-200 px-2.5 py-2 text-xs hover:bg-slate-50"
                  >
                    <span className="text-slate-400">
                      {outgoing
                        ? LINK_KIND_LABEL[link.kind]
                        : LINK_KIND_INVERSE_LABEL[link.kind]}
                      {link.suggested ? " (suggested)" : ""}
                    </span>
                    <span className="mt-1 flex items-start gap-1.5">
                      <span
                        className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: CARD_TYPE_COLOR[other.cardType as CardTypeValue] }}
                      />
                      <span className="text-slate-700 line-clamp-2">
                        {other.quote || other.body}
                      </span>
                    </span>
                    <span className="mt-1 block text-slate-400">
                      {other.document
                        ? `${other.document.filename}${other.page ? `, p.${other.page}` : ""}${
                            other.para ? ` ¶${other.para}` : ""
                          }`
                        : other.sourceTitle || "web"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className={label}>Note / body</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={input} />

        <label className={label}>Type</label>
        <select value={cardType} onChange={(e) => setCardType(e.target.value as CardTypeValue)} className={input}>
          {CARD_TYPES.map((t) => (
            <option key={t} value={t}>
              {CARD_TYPE_LABEL[t]}
            </option>
          ))}
        </select>

        {cardType === "DATE" && (
          <>
            <label className={label}>Event date</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={input} />
          </>
        )}

        {cardType === "CASE_LAW" && (
          <>
            <label className={label}>Citation</label>
            <input value={citation} onChange={(e) => setCitation(e.target.value)} placeholder="e.g. 2025 INSC 1380" className={input} />
            <label className={label}>Proposition</label>
            <textarea value={proposition} onChange={(e) => setProposition(e.target.value)} rows={2} className={input} />
            <label className={label}>Treatment</label>
            <select value={treatment} onChange={(e) => setTreatment(e.target.value)} className={input}>
              <option value="">—</option>
              <option value="RELIED_ON">Relied on</option>
              <option value="DISTINGUISHED">Distinguished</option>
              <option value="OVERRULED_RISK">Overruled risk</option>
            </select>
          </>
        )}

        <label className={label}>Tags (comma-separated, use issue names)</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className={input} />

        <label className="flex items-center gap-2 mt-3 text-sm">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pinned
        </label>

        <div className="flex gap-2 mt-5">
          <button onClick={save} className="rounded bg-slate-900 text-white px-4 py-2 text-sm font-medium">
            Save
          </button>
          <button onClick={remove} className="rounded text-red-600 px-4 py-2 text-sm ml-auto">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

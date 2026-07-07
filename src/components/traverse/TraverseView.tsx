"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type CardDto, type DocumentDto } from "@/lib/clientTypes";
import { DOC_TYPE_LABEL } from "@/lib/labels";
import RichTextEditor, { type AnnexureOption } from "@/components/editor/RichTextEditor";

interface TraverseRowDto {
  id: string;
  order: number;
  paraNo: string;
  paraText: string;
  responseText: string;
  status: string;
  linkedCardIds: string[];
}

interface SheetDto {
  id: string;
  documentId: string;
  document: { id: string; filename: string } | null;
  rows: TraverseRowDto[];
  linkedCards: CardDto[];
}

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  DENIED_BARE: "Denied (bare)",
  DENIED_SPECIFIC: "Denied (specific)",
  ADMITTED: "Admitted",
  ADMITTED_PARTLY: "Admitted partly",
  LEGAL_OBJECTION: "Legal objection",
};

const AT_RISK = new Set(["NOT_STARTED", "DENIED_BARE"]);

export default function TraverseView({ matterId }: { matterId: string }) {
  const [sheet, setSheet] = useState<SheetDto | null>(null);
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [cards, setCards] = useState<CardDto[]>([]);
  const [annexures, setAnnexures] = useState<AnnexureOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);
  const [designating, setDesignating] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState("");

  const load = useCallback(async () => {
    const [docList, cardList, registry] = await Promise.all([
      api<DocumentDto[]>(`/api/matters/${matterId}/documents`),
      api<CardDto[]>(`/api/matters/${matterId}/cards`),
      api<{ items: { documentId: string; document: { filename: string; annexureLabel: string | null } | null }[] }>(
        `/api/matters/${matterId}/annexures`
      ),
    ]);
    setDocs(docList);
    setCards(cardList);
    setAnnexures(
      registry.items
        .filter((i) => i.document?.annexureLabel)
        .map((i) => ({
          id: i.documentId,
          label: i.document!.annexureLabel!,
          filename: i.document!.filename,
        }))
    );
    try {
      setSheet(await api<SheetDto>(`/api/matters/${matterId}/traverse`));
    } catch {
      setSheet(null);
    }
    setLoading(false);
  }, [matterId]);

  useEffect(() => {
    load();
  }, [load]);

  const designate = async () => {
    if (!selectedDoc) return;
    setDesignating(true);
    try {
      await api(`/api/matters/${matterId}/traverse`, {
        method: "POST",
        body: JSON.stringify({ documentId: selectedDoc }),
      });
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDesignating(false);
    }
  };

  const removeSheet = async () => {
    if (!confirm("Delete the traverse sheet and all drafted replies?")) return;
    await api(`/api/matters/${matterId}/traverse`, { method: "DELETE" });
    load();
  };

  if (loading) return <p className="p-6 text-sm text-slate-400">Loading…</p>;

  if (!sheet) {
    const candidates = [...docs].sort((a, b) =>
      a.docType === "PLAINT" ? -1 : b.docType === "PLAINT" ? 1 : 0
    );
    return (
      <div className="p-6 max-w-xl">
        <h1 className="text-lg font-semibold mb-1">Para-wise traverse</h1>
        <p className="text-sm text-slate-500 mb-4">
          Designate the plaint. Its numbered paragraphs become editable rows for the written
          statement.
        </p>
        <div className="flex gap-2">
          <select
            value={selectedDoc}
            onChange={(e) => setSelectedDoc(e.target.value)}
            className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm"
            data-testid="traverse-doc-select"
          >
            <option value="">Select the plaint…</option>
            {candidates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.filename} ({DOC_TYPE_LABEL[d.docType]})
              </option>
            ))}
          </select>
          <button
            onClick={designate}
            disabled={!selectedDoc || designating}
            className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-40"
            data-testid="traverse-create"
          >
            {designating ? "Splitting…" : "Create traverse"}
          </button>
        </div>
      </div>
    );
  }

  const atRiskRows = sheet.rows.filter((r) => AT_RISK.has(r.status));
  const visibleRows = reviewMode ? atRiskRows : sheet.rows;
  const attachable = cards.filter((c) => ["FACT", "EVIDENCE"].includes(c.cardType));

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Para-wise traverse</h1>
          <p className="text-xs text-slate-500">
            {sheet.document?.filename ?? "Plaint"} · {sheet.rows.length} paragraphs ·{" "}
            {sheet.rows.length - atRiskRows.length} addressed
          </p>
        </div>
        <div className="flex gap-2 items-center text-sm">
          <button
            onClick={() => setReviewMode((v) => !v)}
            className={`rounded-md px-3 py-1.5 border text-sm font-medium ${
              reviewMode
                ? "bg-amber-100 border-amber-300 text-amber-900"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            data-testid="review-toggle"
          >
            Deemed-admission guard {reviewMode ? "(on)" : ""}
          </button>
          <a
            href={`/api/matters/${matterId}/exports/written-statement`}
            className="rounded-md bg-slate-900 text-white px-3 py-1.5 font-medium"
            data-testid="export-ws"
          >
            Export written statement (.docx)
          </a>
          <button onClick={removeSheet} className="text-xs text-slate-400 hover:text-red-600">
            Delete sheet
          </button>
        </div>
      </div>

      {reviewMode && (
        <p
          className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
          data-testid="guard-banner"
        >
          <strong>Order VIII Rule 5 CPC:</strong> allegations of fact not specifically denied are
          liable to be treated as admitted. The {atRiskRows.length} row
          {atRiskRows.length === 1 ? "" : "s"} below {atRiskRows.length === 1 ? "is" : "are"} not
          started or contain only a bare denial.
        </p>
      )}

      <div className="space-y-4">
        {visibleRows.map((row) => (
          <TraverseRowCard
            key={row.id}
            row={row}
            attachable={attachable}
            annexures={annexures}
            onStatusChange={(status) =>
              setSheet((cur) =>
                cur
                  ? {
                      ...cur,
                      rows: cur.rows.map((r) => (r.id === row.id ? { ...r, status } : r)),
                    }
                  : cur
              )
            }
          />
        ))}
        {visibleRows.length === 0 && (
          <p className="text-sm text-slate-400">
            {reviewMode ? "No at-risk rows — every paragraph has a specific response." : "No rows."}
          </p>
        )}
      </div>
    </div>
  );
}

function TraverseRowCard({
  row,
  attachable,
  annexures,
  onStatusChange,
}: {
  row: TraverseRowDto;
  attachable: CardDto[];
  annexures: AnnexureOption[];
  onStatusChange: (status: string) => void;
}) {
  const [responseText, setResponseText] = useState(row.responseText);
  const [status, setStatus] = useState(row.status);
  const [linked, setLinked] = useState<string[]>(row.linkedCardIds ?? []);
  const [aiBusy, setAiBusy] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const save = useCallback(
    (patch: { responseText?: string; status?: string; linkedCardIds?: string[] }) => {
      clearTimeout(debounce.current);
      setSaved("saving");
      debounce.current = setTimeout(async () => {
        await api(`/api/traverse-rows/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setSaved("saved");
        setTimeout(() => setSaved("idle"), 1500);
      }, 700);
    },
    [row.id]
  );

  const askAi = async () => {
    setAiBusy(true);
    try {
      const { suggestion } = await api<{ suggestion: string }>(
        `/api/traverse-rows/${row.id}/ai`,
        { method: "POST", body: JSON.stringify({}) }
      );
      const html = suggestion
        .split(/\n{2,}|\n/)
        .filter((s) => s.trim())
        .map((s) => `<p>${s.trim()}</p>`)
        .join("");
      setResponseText(html);
      setStatus("DENIED_SPECIFIC");
      onStatusChange("DENIED_SPECIFIC");
      save({ responseText: html, status: "DENIED_SPECIFIC" });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const toggleCard = (id: string) => {
    const next = linked.includes(id) ? linked.filter((x) => x !== id) : [...linked, id];
    setLinked(next);
    save({ linkedCardIds: next });
  };

  const linkedCards = attachable.filter((c) => linked.includes(c.id));

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white grid grid-cols-2 gap-0"
      data-testid="traverse-row"
    >
      {/* plaint para (left) */}
      <div className="p-4 border-r border-slate-100 bg-slate-50/60 rounded-l-lg">
        <p className="text-xs font-semibold text-slate-400 mb-1">Plaint ¶{row.paraNo}</p>
        <p className="text-sm text-slate-700 leading-relaxed">{row.paraText}</p>
      </div>

      {/* response (right) */}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              onStatusChange(e.target.value);
              save({ status: e.target.value });
            }}
            className={`border rounded px-2 py-1 text-xs font-medium ${
              AT_RISK.has(status)
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-slate-200 text-slate-600"
            }`}
            data-testid="row-status"
          >
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={askAi}
            disabled={aiBusy}
            className="text-xs rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 px-2 py-1 font-medium disabled:opacity-50"
            data-testid="row-ai"
          >
            {aiBusy ? "Drafting…" : "✦ Draft specific denial"}
          </button>
          <span className="ml-auto text-[10px] text-slate-300">
            {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : ""}
          </span>
        </div>

        <RichTextEditor
          content={responseText}
          annexures={annexures}
          onChange={(html) => {
            setResponseText(html);
            save({ responseText: html });
          }}
        />

        <div className="flex items-center gap-1 flex-wrap">
          {linkedCards.map((c) => (
            <span
              key={c.id}
              className="text-[10px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600"
              title={c.body || c.quote}
            >
              {(c.body || c.quote).slice(0, 40)}…
              <button onClick={() => toggleCard(c.id)} className="ml-1 text-slate-400 hover:text-red-500">
                ✕
              </button>
            </span>
          ))}
          <select
            value=""
            onChange={(e) => e.target.value && toggleCard(e.target.value)}
            className="text-[10px] border border-dashed border-slate-300 rounded px-1.5 py-0.5 text-slate-400 bg-transparent"
          >
            <option value="">+ Attach fact/evidence card…</option>
            {attachable
              .filter((c) => !linked.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.cardType}] {(c.body || c.quote).slice(0, 60)}
                </option>
              ))}
          </select>
        </div>
      </div>
    </div>
  );
}

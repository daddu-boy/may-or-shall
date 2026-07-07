"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type DocumentDto, type MatterDto } from "@/lib/clientTypes";

interface RegistryItem {
  id: string;
  documentId: string;
  position: number;
  document: {
    id: string;
    filename: string;
    annexureLabel: string | null;
    pageCount: number;
  } | null;
}

export default function AnnexuresView({ matterId }: { matterId: string }) {
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [prefix, setPrefix] = useState("");
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [matter, setMatter] = useState<MatterDto & { annexurePrefix?: string }>();
  const [addDoc, setAddDoc] = useState("");
  const dragId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [registry, docList, m] = await Promise.all([
      api<{ prefix: string; items: RegistryItem[] }>(`/api/matters/${matterId}/annexures`),
      api<DocumentDto[]>(`/api/matters/${matterId}/documents`),
      api<MatterDto & { annexurePrefix: string }>(`/api/matters/${matterId}`),
    ]);
    setItems(registry.items);
    setPrefix(registry.prefix);
    setDocs(docList);
    setMatter(m);
  }, [matterId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!addDoc) return;
    try {
      await api(`/api/matters/${matterId}/annexures`, {
        method: "POST",
        body: JSON.stringify({ documentId: addDoc }),
      });
      setAddDoc("");
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const remove = async (item: RegistryItem) => {
    await api(`/api/annexures/${item.id}`, { method: "DELETE" });
    load();
  };

  const dropOn = async (target: RegistryItem) => {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === target.id) return;
    const ids = items.map((i) => i.id);
    const fromIdx = ids.indexOf(from);
    const toIdx = ids.indexOf(target.id);
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, from);
    // optimistic
    setItems((cur) => {
      const byId = new Map(cur.map((i) => [i.id, i]));
      return ids.map((id) => byId.get(id)!);
    });
    await api(`/api/matters/${matterId}/annexures`, {
      method: "PATCH",
      body: JSON.stringify({ order: ids }),
    });
    load();
  };

  const savePrefix = async (value: string) => {
    await api(`/api/matters/${matterId}`, {
      method: "PATCH",
      body: JSON.stringify({ annexurePrefix: value }),
    });
    load();
  };

  const available = docs.filter((d) => !items.some((i) => i.documentId === d.id));

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold">Annexures</h1>
        <a
          href={`/api/matters/${matterId}/exports/annexure-index`}
          className="rounded-md bg-slate-900 text-white px-3 py-1.5 text-sm font-medium"
          data-testid="export-annexure-index"
        >
          Export Index of Annexures (.docx)
        </a>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        Drag to reorder — labels renumber automatically and every live @reference in your drafts
        updates.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs text-slate-500">
          Label prefix{" "}
          <input
            value={matter?.annexurePrefix || ""}
            placeholder={prefix}
            onChange={(e) => setMatter((m) => (m ? { ...m, annexurePrefix: e.target.value } : m))}
            onBlur={(e) => savePrefix(e.target.value)}
            className="w-14 border border-slate-200 rounded px-2 py-1 text-sm ml-1"
            data-testid="prefix-input"
          />
        </label>
        <span className="text-xs text-slate-400">
          e.g. P for petitioner-side (Annexure P-1), R for respondent-side
        </span>
      </div>

      <ul className="space-y-1.5 mb-4">
        {items.map((item) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => (dragId.current = item.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              dropOn(item);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-3 cursor-grab active:cursor-grabbing"
            data-testid="annexure-item"
          >
            <span className="text-slate-300 select-none">⠿</span>
            <span
              className="text-xs font-semibold text-indigo-700 bg-indigo-50 rounded px-2 py-0.5 w-32 text-center"
              data-testid="annexure-label"
            >
              {item.document?.annexureLabel ?? "—"}
            </span>
            <span className="text-sm text-slate-700 truncate flex-1">
              {item.document?.filename ?? "(document removed)"}
            </span>
            <span className="text-xs text-slate-400">{item.document?.pageCount ?? "—"} pp</span>
            <button
              onClick={() => remove(item)}
              className="text-xs text-slate-300 hover:text-red-600"
            >
              ✕
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-slate-400">No annexures yet — add documents below.</p>
        )}
      </ul>

      <div className="flex gap-2">
        <select
          value={addDoc}
          onChange={(e) => setAddDoc(e.target.value)}
          className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm"
          data-testid="annexure-add-select"
        >
          <option value="">Add a document to the registry…</option>
          {available.map((d) => (
            <option key={d.id} value={d.id}>
              {d.filename}
            </option>
          ))}
        </select>
        <button
          onClick={add}
          disabled={!addDoc}
          className="rounded-md bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-40"
          data-testid="annexure-add"
        >
          Add
        </button>
      </div>
    </div>
  );
}

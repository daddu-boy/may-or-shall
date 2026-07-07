"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type MatterDto } from "@/lib/clientTypes";
import { OUR_SIDES, OUR_SIDE_LABEL } from "@/lib/labels";

export default function Dashboard() {
  const [matters, setMatters] = useState<MatterDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setMatters(await api<MatterDto[]>("/api/matters"));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = matters.filter((m) => (showArchived ? true : m.status === "ACTIVE"));

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">MatterDock</h1>
          <p className="text-sm text-slate-500 mt-1">Read once, use everywhere.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-700"
          data-testid="new-matter"
        >
          New matter
        </button>
      </div>

      {showForm && (
        <NewMatterForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-slate-400 text-sm">No matters yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((m) => (
            <MatterRow key={m.id} matter={m} onChanged={load} />
          ))}
        </ul>
      )}

      <label className="flex items-center gap-2 mt-6 text-sm text-slate-500">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived
      </label>
    </main>
  );
}

function MatterRow({ matter, onChanged }: { matter: MatterDto; onChanged: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(matter.title);

  const save = async () => {
    if (title.trim() && title !== matter.title) {
      await api(`/api/matters/${matter.id}`, { method: "PATCH", body: JSON.stringify({ title }) });
      onChanged();
    }
    setRenaming(false);
  };

  const toggleArchive = async () => {
    await api(`/api/matters/${matter.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: matter.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }),
    });
    onChanged();
  };

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        {renaming ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="border border-slate-300 rounded px-2 py-1 text-sm w-96"
          />
        ) : (
          <Link
            href={`/matters/${matter.id}/documents`}
            className="font-medium hover:underline truncate block"
          >
            {matter.title}
            {matter.status === "ARCHIVED" && (
              <span className="ml-2 text-xs text-slate-400">(archived)</span>
            )}
          </Link>
        )}
        <p className="text-xs text-slate-500 mt-1 truncate">
          {[matter.court, matter.caseNumber].filter(Boolean).join(" · ") || "No court details"}
          {" · "}
          {matter._count?.documents ?? 0} docs · {matter._count?.cards ?? 0} cards
        </p>
      </div>
      <div className="flex gap-2 shrink-0 text-xs">
        <button onClick={() => setRenaming(true)} className="text-slate-500 hover:text-slate-900">
          Rename
        </button>
        <button onClick={toggleArchive} className="text-slate-500 hover:text-slate-900">
          {matter.status === "ACTIVE" ? "Archive" : "Restore"}
        </button>
      </div>
    </li>
  );
}

function NewMatterForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [court, setCourt] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [parties, setParties] = useState("");
  const [ourSide, setOurSide] = useState<string>("OTHER");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api("/api/matters", {
        method: "POST",
        body: JSON.stringify({ title, court, caseNumber, parties, ourSide }),
      });
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  const input = "border border-slate-300 rounded-md px-3 py-2 text-sm w-full";

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-slate-200 bg-white p-4 mb-6 grid grid-cols-2 gap-3"
    >
      <input
        className={`${input} col-span-2`}
        placeholder="Matter title *"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        data-testid="matter-title"
      />
      <input
        className={input}
        placeholder="Court (e.g. Delhi High Court)"
        value={court}
        onChange={(e) => setCourt(e.target.value)}
      />
      <input
        className={input}
        placeholder="Case number"
        value={caseNumber}
        onChange={(e) => setCaseNumber(e.target.value)}
      />
      <input
        className={`${input} col-span-2`}
        placeholder="Parties"
        value={parties}
        onChange={(e) => setParties(e.target.value)}
      />
      <select className={input} value={ourSide} onChange={(e) => setOurSide(e.target.value)}>
        {OUR_SIDES.map((s) => (
          <option key={s} value={s}>
            {OUR_SIDE_LABEL[s]}
          </option>
        ))}
      </select>
      <div className="flex justify-end">
        <button
          disabled={busy || !title.trim()}
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-40"
          data-testid="create-matter"
        >
          Create matter
        </button>
      </div>
    </form>
  );
}

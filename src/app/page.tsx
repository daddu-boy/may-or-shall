"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type MatterDto } from "@/lib/clientTypes";
import { OUR_SIDES, OUR_SIDE_LABEL } from "@/lib/labels";
import ExtensionNudge from "@/components/ExtensionNudge";

export default function Dashboard() {
  const router = useRouter();
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
          <h1 className="text-2xl font-semibold">May or Shall</h1>
          <p className="text-sm text-slate-500 mt-1">Read once, use everywhere.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-sm text-slate-400 hover:text-slate-700">
            Settings
          </Link>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-700"
            data-testid="new-matter"
          >
            New matter
          </button>
        </div>
      </div>

      <ExtensionNudge />

      {showForm && (
        <NewMatterForm
          onCreated={(matterId) => {
            setShowForm(false);
            router.push(`/matters/${matterId}/documents`);
          }}
        />
      )}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
          <p className="font-medium text-slate-700">Start with a matter</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            A matter is your workspace: upload the bundle, read and highlight the PDFs,
            and build the chronology, traverse, compilations and drafts from what you mark.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            data-testid="empty-create"
          >
            Create your first matter →
          </button>
        </div>
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
  const [deleting, setDeleting] = useState(false);

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

  /**
   * Deleting takes the documents, cards, chronology and drafts with it and
   * cannot be undone, so the confirmation spells out what is about to go and
   * asks for the matter's title back before proceeding.
   */
  const remove = async () => {
    const docs = matter._count?.documents ?? 0;
    const cards = matter._count?.cards ?? 0;
    const contents =
      docs || cards
        ? `${docs} document${docs === 1 ? "" : "s"} and ${cards} card${cards === 1 ? "" : "s"}`
        : "no documents or cards";
    const typed = window.prompt(
      `Delete “${matter.title}” permanently?\n\n` +
        `This matter contains ${contents}. Its chronology, traverse, drafts and ` +
        `annexures will be deleted too. This cannot be undone.\n\n` +
        `Type the matter's name to confirm:`
    );
    if (typed === null) return;
    if (typed.trim() !== matter.title.trim()) {
      window.alert("That doesn't match the matter's name — nothing was deleted.");
      return;
    }
    setDeleting(true);
    try {
      await api(`/api/matters/${matter.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      window.alert(`Could not delete: ${(e as Error).message}`);
      setDeleting(false);
    }
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
        <button
          onClick={remove}
          disabled={deleting}
          className="text-slate-400 hover:text-red-600 disabled:opacity-50"
          data-testid="matter-delete"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </li>
  );
}

function NewMatterForm({ onCreated }: { onCreated: (matterId: string) => void }) {
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
      const matter = await api<{ id: string }>("/api/matters", {
        method: "POST",
        body: JSON.stringify({ title, court, caseNumber, parties, ourSide }),
      });
      onCreated(matter.id);
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

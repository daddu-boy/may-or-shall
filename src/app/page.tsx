"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type MatterDto } from "@/lib/clientTypes";
import {
  MATTER_KINDS,
  MATTER_KIND_BLURB,
  MATTER_KIND_LABEL,
  OUR_SIDES,
  OUR_SIDE_LABEL,
  type MatterKind,
} from "@/lib/labels";
import ExtensionNudge from "@/components/ExtensionNudge";
import Coachmarks from "@/components/Coachmarks";

/** the dashboard tour, stored alongside the per screen tips */
const DASHBOARD_TOUR = "tour:dashboard";

/**
 * The lobby. Dark liquid glass, the same material the browser extension uses,
 * so the two halves of the product stop looking like two products. Matters are
 * tiles rather than a stack of thin rows: a matter is a place you go into, and
 * a tile reads like a door where a row reads like a line item.
 */
export default function Dashboard() {
  const router = useRouter();
  const [matters, setMatters] = useState<MatterDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  /** the dashboard tour is remembered against the account, like every other tip */
  const [tipsSeen, setTipsSeen] = useState<string[] | null>(null);
  const tipsLoaded = useRef(false);
  useEffect(() => {
    if (tipsLoaded.current) return;
    tipsLoaded.current = true;
    api<{ seen: string[] }>("/api/me/tips")
      .then(({ seen }) => {
        // carried up from browser storage once, so the tour does not return
        if (seen.includes(DASHBOARD_TOUR) || localStorage.getItem("mos.tour.dashboard-v1") !== "1") {
          return setTipsSeen(seen);
        }
        setTipsSeen([...seen, DASHBOARD_TOUR]);
        api("/api/me/tips", { method: "POST", body: JSON.stringify({ id: DASHBOARD_TOUR }) })
          .then(() => localStorage.removeItem("mos.tour.dashboard-v1"))
          .catch(() => {});
      })
      .catch(() => setTipsSeen([]));
  }, []);

  const load = useCallback(async () => {
    setMatters(await api<MatterDto[]>("/api/matters"));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = matters.filter((m) => (showArchived ? true : m.status === "ACTIVE"));
  const active = matters.filter((m) => m.status === "ACTIVE").length;
  const docs = matters.reduce((n, m) => n + (m._count?.documents ?? 0), 0);
  const cards = matters.reduce((n, m) => n + (m._count?.cards ?? 0), 0);

  return (
    <main className="night night-ground min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              May or Shall
            </p>
            <h1 className="mt-3 text-[44px] font-semibold leading-none">Matters</h1>
            <p className="mt-4 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
              {loading
                ? "Loading…"
                : matters.length === 0
                  ? "Nothing here yet."
                  : `${active} open · ${docs} document${docs === 1 ? "" : "s"} · ${cards} card${cards === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="flex items-center gap-2.5 pt-2">
            <Link href="/settings" className="chip px-4 py-2.5 text-[13px]">
              Settings
            </Link>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 text-[13px]"
              data-testid="new-matter"
              data-tour="new-matter"
            >
              <span className="text-[15px] leading-none">{showForm ? "×" : "+"}</span>
              {showForm ? "Cancel" : "New matter"}
            </button>
          </div>
        </header>

        <div className="mt-8">
          <ExtensionNudge />
        </div>

        {tipsSeen && (
          <Coachmarks
            id="dashboard-v1"
            seen={tipsSeen.includes(DASHBOARD_TOUR)}
            onSeen={() => {
              setTipsSeen([...tipsSeen, DASHBOARD_TOUR]);
              api("/api/me/tips", {
                method: "POST",
                body: JSON.stringify({ id: DASHBOARD_TOUR }),
              }).catch(() => {});
            }}
            steps={[
              {
                anchor: "matter-row",
                title: "Start with the sample matter",
                body: "We have put a worked example in your account: a plaint, seven cards taken from it, and a chronology. Open it to see how the pieces fit, then delete it whenever you like.",
              },
              {
                anchor: "new-matter",
                title: "Then create your own",
                body: "A matter is your workspace: upload the bundle, read and highlight it, and the chronology, traverse, compilation and drafts build from what you mark.",
              },
            ]}
          />
        )}

        {showForm && (
          <NewMatterForm
            onCreated={(matterId) => {
              setShowForm(false);
              router.push(`/matters/${matterId}/documents`);
            }}
          />
        )}

        {matters.length > 0 && (
          <div className="mt-10 flex items-center justify-between">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {showArchived ? "All matters" : "Open"}
            </p>
            <div className="segment">
              <button data-on={!showArchived} onClick={() => setShowArchived(false)}>
                Open
              </button>
              <button data-on={showArchived} onClick={() => setShowArchived(true)}>
                All
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="mt-6 text-sm" style={{ color: "var(--text-tertiary)" }}>
            Loading…
          </p>
        ) : visible.length === 0 ? (
          <div className="glass mt-10 px-8 py-14 text-center">
            <p className="text-[19px] font-semibold">Start with a matter</p>
            <p
              className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              A matter is your workspace: upload the bundle, read and highlight the PDFs,
              and build the chronology, traverse, compilations and drafts from what you mark.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary mt-6 px-5 py-2.5 text-[13px]"
              data-testid="empty-create"
            >
              Create your first matter
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {visible.map((m, i) => (
              <MatterTile key={m.id} matter={m} onChanged={load} first={i === 0} />
            ))}
            <button
              onClick={() => setShowForm(true)}
              className="tile flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed text-[13px]"
              style={{ borderColor: "var(--hairline-strong)", color: "var(--text-tertiary)" }}
            >
              <span className="text-[20px] leading-none">+</span>
              New matter
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function MatterTile({
  matter,
  onChanged,
  first,
}: {
  matter: MatterDto;
  onChanged: () => void;
  first?: boolean;
}) {
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

  const where = [matter.court, matter.caseNumber].filter(Boolean).join(" · ");

  return (
    <div
      data-tour={first ? "matter-row" : undefined}
      className="glass tile group relative flex min-h-[132px] cursor-pointer flex-col justify-between p-5"
    >
      {/*
        The whole tile opens the matter. The link is laid over the tile and the
        content underneath it is left unpositioned, so the link is what the
        pointer meets anywhere on the face of the card. Only the controls lift
        themselves back above it.
      */}
      {!renaming && (
        <Link
          href={`/matters/${matter.id}/documents`}
          aria-label={`Open ${matter.title}`}
          className="absolute inset-0 rounded-[14px]"
        />
      )}

      <div className="min-w-0">
        {renaming ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="field relative z-10 w-full px-3 py-1.5 text-[15px]"
          />
        ) : (
          <h2 className="truncate text-[19px] font-semibold leading-snug">
            {matter.title}
            {matter.status === "ARCHIVED" && (
              <span
                className="ml-2 align-middle text-[10.5px] font-medium uppercase tracking-[0.1em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Archived
              </span>
            )}
          </h2>
        )}
        <p className="mt-1.5 truncate text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          {matter.kind === "PROJECT" ? "Project" : where || "No court details"}
        </p>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="flex gap-1.5">
          <Stat n={matter._count?.documents ?? 0} one="document" many="documents" />
          <Stat n={matter._count?.cards ?? 0} one="card" many="cards" />
        </div>
        <div
          className="relative z-10 flex gap-2 text-[12px] opacity-70 transition-opacity group-hover:opacity-100"
          style={{ color: "var(--text-secondary)" }}
        >
          <button onClick={() => setRenaming(true)} className="hover:text-[var(--text)]">
            Rename
          </button>
          <button onClick={toggleArchive} className="hover:text-[var(--text)]">
            {matter.status === "ACTIVE" ? "Archive" : "Restore"}
          </button>
          <button
            onClick={remove}
            disabled={deleting}
            className="disabled:opacity-50 hover:text-[#ff6b6b]"
            data-testid="matter-delete"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11.5px]"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid var(--glass-edge)",
        color: "var(--text-secondary)",
      }}
    >
      <span style={{ color: "var(--text)" }}>{n}</span> {n === 1 ? one : many}
    </span>
  );
}

function NewMatterForm({ onCreated }: { onCreated: (matterId: string) => void }) {
  /**
   * The kind is asked first because it decides what else is worth asking.
   * A project has no court and no case number, and being made to skip past
   * two empty fields is its own small insult.
   */
  const [kind, setKind] = useState<MatterKind>("CASE");
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
        body: JSON.stringify(
          kind === "CASE"
            ? { kind, title, court, caseNumber, parties, ourSide }
            : { kind, title, parties }
        ),
      });
      onCreated(matter.id);
    } finally {
      setBusy(false);
    }
  };

  const input = "field px-3.5 py-2.5 text-[13.5px] w-full";

  return (
    <form onSubmit={submit} className="glass mt-8 p-6">
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        New matter
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {MATTER_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className="rounded-[14px] border p-4 text-left transition-colors"
            style={{
              borderColor: kind === k ? "var(--text)" : "var(--hairline)",
              background: kind === k ? "rgba(255,255,255,0.08)" : "transparent",
            }}
            data-testid={`kind-${k.toLowerCase()}`}
          >
            <span className="text-[14px] font-semibold">{MATTER_KIND_LABEL[k]}</span>
            <span
              className="mt-1 block text-[12px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {MATTER_KIND_BLURB[k]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <input
          className={`${input} col-span-2`}
          placeholder={kind === "CASE" ? "Matter title *" : "Project title *"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="matter-title"
        />

        {kind === "CASE" && (
          <>
            <input
              className={input}
              placeholder="Court (e.g. Delhi High Court)"
              value={court}
              onChange={(e) => setCourt(e.target.value)}
              data-testid="matter-court"
            />
            <input
              className={input}
              placeholder="Case number"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              data-testid="matter-case-number"
            />
          </>
        )}

        <input
          className={`${input} col-span-2`}
          placeholder={kind === "CASE" ? "Parties" : "Subject, or who this is for"}
          value={parties}
          onChange={(e) => setParties(e.target.value)}
        />

        {kind === "CASE" && (
          <select className={input} value={ourSide} onChange={(e) => setOurSide(e.target.value)}>
            {OUR_SIDES.map((s) => (
              <option key={s} value={s}>
                {OUR_SIDE_LABEL[s]}
              </option>
            ))}
          </select>
        )}

        <div className={kind === "CASE" ? "flex justify-end" : "col-span-2 flex justify-end"}>
          <button
            disabled={busy || !title.trim()}
            className="btn-primary px-5 py-2.5 text-[13px] disabled:opacity-40"
            data-testid="create-matter"
          >
            {busy ? "Creating…" : `Create ${MATTER_KIND_LABEL[kind].toLowerCase()}`}
          </button>
        </div>
      </div>
    </form>
  );
}

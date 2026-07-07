"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/clientTypes";
import RichTextEditor, { type AnnexureOption } from "@/components/editor/RichTextEditor";

interface ArtefactDto {
  id: string;
  matterId: string;
  artefactType: string;
  title: string;
  content: string;
  version: number;
}

export default function DraftEditor({
  matterId,
  artefactId,
}: {
  matterId: string;
  artefactId: string;
}) {
  const router = useRouter();
  const [artefact, setArtefact] = useState<ArtefactDto | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [annexures, setAnnexures] = useState<AnnexureOption[]>([]);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [regenBusy, setRegenBusy] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    (async () => {
      const [a, registry] = await Promise.all([
        api<ArtefactDto>(`/api/artefacts/${artefactId}`),
        api<{ items: { documentId: string; document: { filename: string; annexureLabel: string | null } | null }[] }>(
          `/api/matters/${matterId}/annexures`
        ),
      ]);
      setArtefact(a);
      setContent(a.content);
      setTitle(a.title);
      setAnnexures(
        registry.items
          .filter((i) => i.document?.annexureLabel)
          .map((i) => ({
            id: i.documentId,
            label: i.document!.annexureLabel!,
            filename: i.document!.filename,
          }))
      );
    })();
  }, [artefactId, matterId]);

  const save = useCallback(
    (patch: { content?: string; title?: string }) => {
      clearTimeout(debounce.current);
      setSaved("saving");
      debounce.current = setTimeout(async () => {
        await api(`/api/artefacts/${artefactId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setSaved("saved");
        setTimeout(() => setSaved("idle"), 1500);
      }, 800);
    },
    [artefactId]
  );

  const regenerate = async () => {
    if (!confirm("Regenerate with AI? This creates a new version — this one is kept.")) return;
    setRegenBusy(true);
    try {
      const next = await api<ArtefactDto>(`/api/artefacts/${artefactId}/regenerate`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      router.push(`/matters/${matterId}/drafts/${next.id}`);
    } catch (e) {
      alert((e as Error).message);
      setRegenBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this version?")) return;
    await api(`/api/artefacts/${artefactId}`, { method: "DELETE" });
    router.push(`/matters/${matterId}/drafts`);
  };

  if (!artefact) return <p className="p-6 text-sm text-slate-400">Loading…</p>;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Link href={`/matters/${matterId}/drafts`} className="text-xs text-slate-400 hover:text-slate-600">
          ← Drafts
        </Link>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            save({ title: e.target.value });
          }}
          className="text-lg font-semibold bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none flex-1 min-w-64"
        />
        <span className="text-xs text-slate-400">v{artefact.version}</span>
        <span className="text-[10px] text-slate-300 w-12">
          {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : ""}
        </span>
        <button
          onClick={regenerate}
          disabled={regenBusy}
          className="text-xs rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 px-2.5 py-1.5 font-medium disabled:opacity-50"
        >
          {regenBusy ? "Regenerating…" : "✦ Regenerate (new version)"}
        </button>
        <a
          href={`/api/artefacts/${artefactId}/export`}
          className="text-xs rounded-md bg-slate-900 text-white px-2.5 py-1.5 font-medium"
        >
          Export .docx
        </a>
        <button onClick={remove} className="text-xs text-slate-400 hover:text-red-600">
          Delete
        </button>
      </div>

      <p className="text-[11px] text-slate-400 mb-2">
        Sentences in [square brackets] were bridging text added by the AI — verify before filing.
      </p>

      <RichTextEditor
        content={content}
        annexures={annexures}
        minHeight={480}
        onChange={(html) => {
          setContent(html);
          save({ content: html });
        }}
      />
    </div>
  );
}

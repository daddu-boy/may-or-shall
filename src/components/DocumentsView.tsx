"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, type DocumentDto } from "@/lib/clientTypes";
import { DOC_TYPES, DOC_TYPE_LABEL } from "@/lib/labels";

interface UploadProgress {
  name: string;
  percent: number;
  status: "uploading" | "processing" | "done" | "error";
  error?: string;
  /** highlights the file already carried, turned into cards on arrival */
  imported?: number;
}

export default function DocumentsView({ matterId }: { matterId: string }) {
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [ocrBusy, setOcrBusy] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState("");
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setDocs(await api<DocumentDto[]>(`/api/matters/${matterId}/documents`));
  }, [matterId]);

  useEffect(() => {
    load();
  }, [load]);

  /** One XHR per file so we get real upload progress (PRD F1: multi-upload with progress). */
  const uploadFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const entry: UploadProgress = { name: file.name, percent: 0, status: "uploading" };
      setUploads((u) => [...u, entry]);
      const update = (patch: Partial<UploadProgress>) =>
        setUploads((u) => u.map((x) => (x === entry ? Object.assign(entry, patch) : x)));

      const form = new FormData();
      form.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/matters/${matterId}/documents`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          update({ percent, status: percent === 100 ? "processing" : "uploading" });
        }
      };
      xhr.onload = () => {
        if (xhr.status < 300) {
          let imported = 0;
          try {
            imported = JSON.parse(xhr.responseText).importedCards || 0;
          } catch {
            /* the count is a nicety; the upload itself succeeded */
          }
          update({ status: "done", percent: 100, imported });
          load();
        } else {
          let msg = "Upload failed";
          try {
            msg = JSON.parse(xhr.responseText).error || msg;
          } catch {}
          update({ status: "error", error: msg });
        }
      };
      xhr.onerror = () => update({ status: "error", error: "Network error" });
      xhr.send(form);
    });
  };

  const retryOcr = async (doc: DocumentDto) => {
    setOcrBusy(doc.id);
    setOcrError("");
    try {
      await api(`/api/documents/${doc.id}/ocr`, { method: "POST" });
      await load();
    } catch (e) { setOcrError((e as Error).message); }
    finally { setOcrBusy(null); }
  };

  const changeType = async (doc: DocumentDto, docType: string) => {
    await api(`/api/documents/${doc.id}`, { method: "PATCH", body: JSON.stringify({ docType }) });
    load();
  };

  const remove = async (doc: DocumentDto) => {
    try {
      await api(`/api/documents/${doc.id}`, { method: "DELETE" });
    } catch (e) {
      const err = e as Error & { status?: number; body?: { cardCount?: number } };
      if (err.status === 409) {
        const n = err.body?.cardCount ?? 0;
        if (
          !confirm(
            `"${doc.filename}" has ${n} card${n === 1 ? "" : "s"} linked to it. ` +
              `Deleting it will orphan ${n === 1 ? "that card" : "those cards"} (they keep their text but lose the deep link). Delete anyway?`
          )
        )
          return;
        await api(`/api/documents/${doc.id}?force=1`, { method: "DELETE" });
      } else {
        alert(err.message);
        return;
      }
    }
    load();
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Documents</h1>
        <button
          onClick={() => fileInput.current?.click()}
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-700"
          data-testid="upload-button"
        >
          Upload PDFs
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
        className="rounded-lg border-2 border-dashed border-slate-200 p-4 mb-6 text-center text-sm text-slate-400"
      >
        Drag and drop PDFs here, or use the Upload button.
      </div>

      <p className="text-xs text-slate-500 mb-3">Scans receive automatic OCR on this server. Up to 50 MB and 500 pages per PDF; automatic OCR supports up to 100 scanned pages. Keep this page open during processing.</p>
      {ocrError && <p role="alert" className="text-sm text-red-600 mb-3">{ocrError}</p>}
      {uploads.length > 0 && (
        <ul className="mb-6 space-y-2">
          {uploads.map((u, i) => (
            <li key={i} className="text-xs text-slate-600 flex items-center gap-3">
              <span className="w-64 truncate">{u.name}</span>
              {u.status === "error" ? (
                <span className="text-red-600">{u.error}</span>
              ) : (
                <>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden">
                    <div
                      className={`h-full ${u.status === "done" ? "bg-emerald-500" : "bg-blue-500"}`}
                      style={{ width: `${u.percent}%` }}
                    />
                  </div>
                  <span className="w-20 text-right">
                    {u.status === "processing" ? "Processing…" : u.status === "done" ? "Done" : `${u.percent}%`}
                  </span>
                  {u.status === "done" && !!u.imported && (
                    <a
                      href={`/matters/${matterId}/cards?tag=imported`}
                      className="shrink-0 whitespace-nowrap underline"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {u.imported} highlight{u.imported === 1 ? "" : "s"} became cards
                    </a>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {docs.length === 0 ? (
        <p className="text-sm text-slate-400">No documents yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="rounded-lg border border-slate-200 bg-white p-3 flex items-center gap-4"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/matters/${matterId}/documents/${doc.id}`}
                  className="font-medium text-sm hover:underline truncate block"
                  data-testid="document-link"
                >
                  {doc.filename}
                </Link>
                <p className="text-xs text-slate-500 mt-0.5">
                  {doc.pageCount} pages · {doc._count?.cards ?? 0} cards
                  {!doc.hasTextLayer && (
                    <span className="ml-2 text-amber-600">
                      Some pages have little or no selectable text
                    </span>
                  )}
                </p>
                {doc.extractionReport?.message && <p className="text-xs text-amber-700 mt-1">{doc.extractionReport.message}</p>}
                {!!doc.extractionReport?.warningPages?.length && <p className="text-xs text-amber-700">Check pages: {doc.extractionReport.warningPages.join(", ")}</p>}
                <a href={`/api/documents/${doc.id}/file?original=1`} target="_blank" rel="noreferrer" className="text-xs underline">Open original PDF</a>
                {(!doc.hasTextLayer || !!doc.extractionReport?.warningPages?.length) && (
                  <button disabled={ocrBusy !== null} onClick={() => retryOcr(doc)} className="ml-3 text-xs underline disabled:opacity-50">{ocrBusy === doc.id ? "Running OCR…" : "Retry OCR"}</button>
                )}
              </div>
              <select
                value={doc.docType}
                onChange={(e) => changeType(doc, e.target.value)}
                className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-600"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOC_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => remove(doc)}
                className="text-xs text-slate-400 hover:text-red-600"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api, type DocumentDto } from "@/lib/clientTypes";
import CompareDesk from "./CompareDesk";
import type { MatterKind } from "@/lib/labels";

/** Fetches the matter's documents, then hands the desk two of them to open. */
export default function CompareLoader({
  matterId,
  kind,
}: {
  matterId: string;
  kind?: MatterKind;
}) {
  const [documents, setDocuments] = useState<DocumentDto[] | null>(null);

  useEffect(() => {
    api<DocumentDto[]>(`/api/matters/${matterId}/documents`).then(setDocuments);
  }, [matterId]);

  if (!documents) return <div className="p-10 text-sm text-slate-400">Loading documents…</div>;
  return <CompareDesk matterId={matterId} documents={documents} kind={kind} />;
}

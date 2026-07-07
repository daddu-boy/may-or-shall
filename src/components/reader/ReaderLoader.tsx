"use client";

import dynamic from "next/dynamic";

// pdf.js touches DOM APIs at module scope, so the reader is client-only.
const Reader = dynamic(() => import("./Reader"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-slate-400">Loading reader…</p>,
});

export default function ReaderLoader(props: {
  matterId: string;
  docId: string;
  initialPage?: number;
  initialCardId?: string;
}) {
  return <Reader {...props} />;
}

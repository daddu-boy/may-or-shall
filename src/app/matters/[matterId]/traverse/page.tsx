import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import TraverseView from "@/components/traverse/TraverseView";
import { aiAvailable } from "@/lib/ai";

/** Litigation only: answering a plaint paragraph by paragraph. */
export default async function TraversePage({ params }: { params: { matterId: string } }) {
  const matter = await prisma.matter.findUnique({
    where: { id: params.matterId },
    select: { kind: true },
  });
  if (!matter || matter.kind === "PROJECT") notFound();
  // The per-row AI suggestion is hidden when no key is configured; the rest of
  // the traverse sheet works normally.
  return <TraverseView matterId={params.matterId} aiAvailable={aiAvailable()} />;
}

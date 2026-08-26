import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import AnnexuresView from "@/components/AnnexuresView";

/**
 * Litigation only. The rail does not offer it in a project, so reaching here
 * means a typed or bookmarked URL, and the honest answer is that this screen
 * does not exist for this matter.
 */
export default async function AnnexuresPage({ params }: { params: { matterId: string } }) {
  const matter = await prisma.matter.findUnique({
    where: { id: params.matterId },
    select: { kind: true },
  });
  if (!matter || matter.kind === "PROJECT") notFound();
  return <AnnexuresView matterId={params.matterId} />;
}

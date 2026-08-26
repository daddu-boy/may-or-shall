import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import CompareLoader from "@/components/CompareLoader";

export default async function ComparePage({ params }: { params: { matterId: string } }) {
  const matter = await prisma.matter.findUnique({
    where: { id: params.matterId },
    select: { kind: true },
  });
  if (!matter) notFound();
  return (
    <CompareLoader
      matterId={params.matterId}
      kind={matter.kind === "PROJECT" ? "PROJECT" : "CASE"}
    />
  );
}

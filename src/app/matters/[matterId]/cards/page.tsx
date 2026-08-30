import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import CardsWorkspace from "@/components/CardsWorkspace";

export default async function CardsPage({
  params,
  searchParams,
}: {
  params: { matterId: string };
  searchParams: { card?: string; tab?: string };
}) {
  const matter = await prisma.matter.findUnique({
    where: { id: params.matterId },
    select: { kind: true },
  });
  if (!matter) notFound();

  return (
    <CardsWorkspace
      matterId={params.matterId}
      initialCardId={searchParams.card}
      initialTab={searchParams.tab}
      kind={matter.kind === "PROJECT" ? "PROJECT" : "CASE"}
    />
  );
}

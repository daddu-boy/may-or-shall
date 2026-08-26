import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ReaderLoader from "@/components/reader/ReaderLoader";

export default async function ReaderPage({
  params,
  searchParams,
}: {
  params: { matterId: string; docId: string };
  searchParams: { page?: string; card?: string };
}) {
  // the kind decides the vocabulary the save popover offers
  const matter = await prisma.matter.findUnique({
    where: { id: params.matterId },
    select: { kind: true },
  });
  if (!matter) notFound();

  return (
    <ReaderLoader
      matterId={params.matterId}
      docId={params.docId}
      kind={matter.kind === "PROJECT" ? "PROJECT" : "CASE"}
      initialPage={searchParams.page ? parseInt(searchParams.page, 10) : undefined}
      initialCardId={searchParams.card}
    />
  );
}

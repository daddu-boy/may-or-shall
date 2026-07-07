import ReaderLoader from "@/components/reader/ReaderLoader";

export default function ReaderPage({
  params,
  searchParams,
}: {
  params: { matterId: string; docId: string };
  searchParams: { page?: string; card?: string };
}) {
  return (
    <ReaderLoader
      matterId={params.matterId}
      docId={params.docId}
      initialPage={searchParams.page ? parseInt(searchParams.page, 10) : undefined}
      initialCardId={searchParams.card}
    />
  );
}

import Board from "@/components/board/Board";

export default function CardsPage({
  params,
  searchParams,
}: {
  params: { matterId: string };
  searchParams: { card?: string };
}) {
  return <Board matterId={params.matterId} initialCardId={searchParams.card} />;
}

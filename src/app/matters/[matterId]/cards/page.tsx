import CardsWorkspace from "@/components/CardsWorkspace";

export default function CardsPage({
  params,
  searchParams,
}: {
  params: { matterId: string };
  searchParams: { card?: string; tab?: string };
}) {
  return (
    <CardsWorkspace
      matterId={params.matterId}
      initialCardId={searchParams.card}
      initialTab={searchParams.tab}
    />
  );
}

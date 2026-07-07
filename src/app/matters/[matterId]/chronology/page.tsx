import ChronologyView from "@/components/ChronologyView";

export default function ChronologyPage({ params }: { params: { matterId: string } }) {
  return <ChronologyView matterId={params.matterId} />;
}

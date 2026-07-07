import TraverseView from "@/components/traverse/TraverseView";

export default function TraversePage({ params }: { params: { matterId: string } }) {
  return <TraverseView matterId={params.matterId} />;
}

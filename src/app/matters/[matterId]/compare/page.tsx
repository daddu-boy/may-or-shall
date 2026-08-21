import CompareLoader from "@/components/CompareLoader";

export default function ComparePage({ params }: { params: { matterId: string } }) {
  return <CompareLoader matterId={params.matterId} />;
}

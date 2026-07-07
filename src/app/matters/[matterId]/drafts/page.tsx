import DraftsView from "@/components/drafts/DraftsView";

export default function DraftsPage({ params }: { params: { matterId: string } }) {
  return <DraftsView matterId={params.matterId} />;
}

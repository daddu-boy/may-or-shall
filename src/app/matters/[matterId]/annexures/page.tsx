import AnnexuresView from "@/components/AnnexuresView";

export default function AnnexuresPage({ params }: { params: { matterId: string } }) {
  return <AnnexuresView matterId={params.matterId} />;
}

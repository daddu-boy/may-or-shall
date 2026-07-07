import DocumentsView from "@/components/DocumentsView";

export default function DocumentsPage({ params }: { params: { matterId: string } }) {
  return <DocumentsView matterId={params.matterId} />;
}

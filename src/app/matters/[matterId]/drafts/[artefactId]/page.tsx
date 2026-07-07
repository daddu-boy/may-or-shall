import DraftEditor from "@/components/drafts/DraftEditor";

export default function DraftEditorPage({
  params,
}: {
  params: { matterId: string; artefactId: string };
}) {
  return <DraftEditor matterId={params.matterId} artefactId={params.artefactId} />;
}

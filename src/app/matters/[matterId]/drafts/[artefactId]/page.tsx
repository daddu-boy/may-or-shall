import DraftEditor from "@/components/drafts/DraftEditor";
import { aiAvailable } from "@/lib/ai";

export default function DraftEditorPage({
  params,
}: {
  params: { matterId: string; artefactId: string };
}) {
  return (
    <DraftEditor
      matterId={params.matterId}
      artefactId={params.artefactId}
      aiAvailable={aiAvailable()}
    />
  );
}

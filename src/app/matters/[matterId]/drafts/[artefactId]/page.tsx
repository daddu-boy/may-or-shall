import DraftEditor from "@/components/drafts/DraftEditor";
import { aiReadiness } from "@/lib/ai";

export default async function DraftEditorPage({
  params,
}: {
  params: { matterId: string; artefactId: string };
}) {
  return (
    <DraftEditor
      matterId={params.matterId}
      artefactId={params.artefactId}
      aiAvailable={(await aiReadiness(true, ["senior-brief", "written-submissions", "judge-note"])) === null}
    />
  );
}

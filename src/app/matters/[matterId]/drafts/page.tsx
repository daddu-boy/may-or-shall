import DraftsView from "@/components/drafts/DraftsView";
import { aiReadiness } from "@/lib/ai";

export default async function DraftsPage({ params }: { params: { matterId: string } }) {
  // Without ANTHROPIC_API_KEY the AI options could only ever error, so they are
  // hidden rather than offered. Blank drafts, editing and export still work.
  return <DraftsView matterId={params.matterId} aiAvailable={(await aiReadiness(true, ["senior-brief", "written-submissions", "judge-note"])) === null} />;
}

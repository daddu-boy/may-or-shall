import TraverseView from "@/components/traverse/TraverseView";
import { aiAvailable } from "@/lib/ai";

export default function TraversePage({ params }: { params: { matterId: string } }) {
  // The per-row AI suggestion is hidden when no key is configured; the rest of
  // the traverse sheet works normally.
  return <TraverseView matterId={params.matterId} aiAvailable={aiAvailable()} />;
}

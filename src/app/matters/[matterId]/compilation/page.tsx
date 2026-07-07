import CompilationView from "@/components/CompilationView";

export default function CompilationPage({ params }: { params: { matterId: string } }) {
  return <CompilationView matterId={params.matterId} />;
}

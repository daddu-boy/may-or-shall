import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import MatterShell from "@/components/MatterShell";

export default async function MatterLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { matterId: string };
}) {
  const matter = await prisma.matter.findUnique({ where: { id: params.matterId } });
  if (!matter) notFound();

  return (
    <MatterShell
      matterId={matter.id}
      title={matter.title}
      subtitle={[matter.court, matter.caseNumber].filter(Boolean).join(" · ")}
    >
      {children}
    </MatterShell>
  );
}

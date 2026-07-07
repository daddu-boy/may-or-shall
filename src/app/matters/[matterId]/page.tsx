import { redirect } from "next/navigation";

export default function MatterIndex({ params }: { params: { matterId: string } }) {
  redirect(`/matters/${params.matterId}/documents`);
}

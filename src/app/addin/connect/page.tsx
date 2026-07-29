import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/apiAuth";
import ConnectHandoff from "@/components/addin/ConnectHandoff";

/**
 * Opened by the Word task pane in an Office dialog. If the visitor isn't signed
 * in they get the normal magic-link sign-in and come back here; once signed in
 * we mint a token and hand it straight to the pane (see ConnectHandoff), so the
 * user never copies anything.
 */
export const dynamic = "force-dynamic";

const ADDIN_TOKEN_NAME = "Word add-in";

export default async function AddinConnectPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/signin?callbackUrl=${encodeURIComponent("/addin/connect")}`);

  // one live add-in token per user: retire any earlier ones
  await prisma.apiToken.updateMany({
    where: { userId, name: ADDIN_TOKEN_NAME, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const token = generateToken();
  await prisma.apiToken.create({
    data: { name: ADDIN_TOKEN_NAME, tokenHash: hashToken(token), userId },
  });

  return <ConnectHandoff token={token} />;
}

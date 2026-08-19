import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { SCOPE, parseRedirectUris, resourceUrl } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/**
 * The consent screen. This is the whole point of the OAuth work: connecting an
 * AI client becomes "sign in and click Allow" rather than "create a token and
 * paste it", which is both nicer and what a directory listing requires.
 *
 * It is deliberately explicit about what the client will be able to read and
 * write, because the material is privileged and the user is a lawyer.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const one = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v || "";
  };

  const clientId = one("client_id");
  const redirectUri = one("redirect_uri");
  const responseType = one("response_type");
  const codeChallenge = one("code_challenge");
  const challengeMethod = one("code_challenge_method");
  const state = one("state");
  const resource = one("resource") || resourceUrl();

  const problem = (message: string) => (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8">
        <h1 className="text-lg font-semibold">This connection request is not valid</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <p className="mt-4 text-xs text-slate-400">
          Nothing has been shared. You can close this window.
        </p>
      </div>
    </main>
  );

  if (responseType !== "code") return problem("Only the authorization code flow is supported.");
  if (!codeChallenge || challengeMethod !== "S256")
    return problem("This client did not use PKCE, which is required.");

  const client = clientId
    ? await prisma.oAuthClient.findUnique({ where: { clientId } })
    : null;
  if (!client) return problem("The application asking for access is not registered.");
  if (!parseRedirectUris(client.redirectUris).includes(redirectUri))
    return problem("The return address does not match the one this application registered.");

  const session = await auth();
  if (!session?.user?.id) {
    const self = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: responseType,
      code_challenge: codeChallenge,
      code_challenge_method: challengeMethod,
      state,
      resource,
    });
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/oauth/authorize?${self}`)}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8">
        <h1 className="text-xl font-semibold">Connect {client.clientName}?</h1>
        <p className="mt-2 text-sm text-slate-600">
          Signed in as {session.user.email}.
        </p>

        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">It will be able to</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>list your matters and their documents</li>
            <li>read the cards you have saved, with their quotes and citations</li>
            <li>see which paragraphs of a plaint are still unanswered</li>
            <li>save new cards into a matter</li>
          </ul>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Whatever this application reads is sent to whoever operates it, under your account
          with them. Only connect something you would be willing to show a client&rsquo;s file
          to. You can disconnect it at any time under Settings.
        </p>

        <form action="/api/oauth/authorize" method="POST" className="mt-6 flex gap-3">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="code_challenge" value={codeChallenge} />
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="resource" value={resource} />
          <button
            type="submit"
            name="decision"
            value="allow"
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Allow
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">Scope: {SCOPE}</p>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";

/**
 * Sign-in for the demo account. Not linked from anywhere in the product: it
 * exists so an app-store reviewer can get in without an inbox of ours.
 */
export default function DemoSignInPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const failed = searchParams.error !== undefined;
  const raw = searchParams.callbackUrl;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  // same rule as the route: a path on this site, or nothing
  const callbackUrl =
    requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "";
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8">
        <h1 className="text-xl font-semibold">May or Shall</h1>
        <p className="mt-1 text-sm text-slate-500">
          Demo account sign in, for reviewers.
        </p>

        {failed && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Those credentials were not accepted.
          </p>
        )}

        <form action="/api/demo-signin" method="POST" className="mt-6 space-y-3">
          {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
          <input
            name="email"
            type="email"
            autoComplete="username"
            placeholder="Email"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
          />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Sign in
          </button>
        </form>

        <p className="mt-5 text-xs leading-relaxed text-slate-400">
          This account contains a generated sample matter only. It holds no real
          client material. Everyone else signs in with a link sent to their email
          address, at <a className="underline" href="/signin">the normal sign in page</a>.
        </p>
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/clientTypes";

interface TokenDto {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export default function SettingsPage() {
  const [tokens, setTokens] = useState<TokenDto[]>([]);
  const [name, setName] = useState("");
  const [freshToken, setFreshToken] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setTokens(await api<TokenDto[]>("/api/tokens"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await api<{ name: string; token: string }>("/api/tokens", {
      method: "POST",
      body: JSON.stringify({ name: name.trim() }),
    });
    setFreshToken(created);
    setCopied(false);
    setName("");
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this token? Clients using it will stop working.")) return;
    await api(`/api/tokens/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">
        ← All matters
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">Settings</h1>
      <p className="text-sm text-slate-500 mb-8">
        API tokens for the browser extension and other clients.
      </p>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold mb-1">API tokens</h2>
        <p className="text-xs text-slate-500 mb-4">
          The Chrome extension authenticates with a token (Extension options → paste it there).
          Tokens are shown once at creation and stored hashed.
        </p>

        <form onSubmit={create} className="flex gap-2 mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Token name, e.g. Chrome extension — MacBook"
            className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm"
            data-testid="token-name"
          />
          <button
            disabled={!name.trim()}
            className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-40"
            data-testid="token-create"
          >
            Create token
          </button>
        </form>

        {freshToken && (
          <div
            className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3"
            data-testid="fresh-token"
          >
            <p className="text-xs text-emerald-800 mb-1.5">
              Token for <strong>{freshToken.name}</strong> — copy it now, it will not be shown
              again:
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-white border border-emerald-200 rounded px-2 py-1 flex-1 break-all">
                {freshToken.token}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(freshToken.token);
                  setCopied(true);
                }}
                className="text-xs rounded bg-emerald-600 text-white px-2.5 py-1.5 font-medium"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <ul className="divide-y divide-slate-100">
          {tokens.map((t) => (
            <li key={t.id} className="py-2.5 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <span className={t.revokedAt ? "line-through text-slate-400" : "font-medium"}>
                  {t.name}
                </span>
                <p className="text-xs text-slate-400">
                  created {new Date(t.createdAt).toLocaleDateString()}
                  {t.lastUsedAt &&
                    ` · last used ${new Date(t.lastUsedAt).toLocaleString()}`}
                  {t.revokedAt && " · revoked"}
                </p>
              </div>
              {!t.revokedAt && (
                <button
                  onClick={() => revoke(t.id)}
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
          {tokens.length === 0 && (
            <p className="text-xs text-slate-400 py-2">No tokens yet.</p>
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 mt-6 text-sm">
        <h2 className="text-sm font-semibold mb-2">Clients</h2>
        <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
          <li>
            <strong>Chrome extension</strong> — load <code>extension/</code> from the repo via
            chrome://extensions → &quot;Load unpacked&quot;, then paste a token and pick a matter in its
            options.
          </li>
          <li>
            <strong>Word add-in</strong> — see <code>office-addin/README.md</code> in the repo;
            the task pane is served by this app at <code>/addin/taskpane</code>.
          </li>
        </ul>
      </section>
    </main>
  );
}

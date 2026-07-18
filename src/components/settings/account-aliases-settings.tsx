"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AliasRow = {
  id: string;
  alias: string;
  normalizedAlias: string;
  source: string;
  financialAccountId: string;
};

type AccountRow = { id: string; nickname: string; institution: string };

export function AccountAliasesSettings() {
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [newAlias, setNewAlias] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/account-aliases");
      if (res.ok) {
        const data = await res.json();
        setAliases(data.aliases ?? []);
        setAccounts(data.accounts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addAlias = async () => {
    if (!newAlias.trim() || !accountId) return;
    const res = await fetch("/api/v1/account-aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias: newAlias.trim(), financialAccountId: accountId }),
    });
    if (res.ok) {
      setNewAlias("");
      load();
    }
  };

  const removeAlias = async (id: string) => {
    await fetch(`/api/v1/account-aliases?id=${id}`, { method: "DELETE" });
    load();
  };

  const userAliases = aliases.filter((a) => a.source === "USER" || a.source === "AI_LEARNED");

  return (
    <div className="rounded-xl border border-fk-border/60 bg-fk-charcoal/30 p-4">
      <h3 className="text-sm font-semibold text-fk-gold">Account aliases</h3>
      <p className="mt-1 text-xs text-fk-muted">
        Teach Finance King how you refer to accounts in speech or text (e.g. &quot;main checking&quot;, &quot;rental account&quot;).
      </p>

      {loading ? (
        <p className="mt-3 text-xs text-fk-muted">Loading…</p>
      ) : (
        <>
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
            {userAliases.length === 0 ? (
              <li className="text-fk-muted">No custom aliases yet.</li>
            ) : (
              userAliases.map((a) => {
                const acct = accounts.find((x) => x.id === a.financialAccountId);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-fk-navy/50 px-2 py-1.5">
                    <span>
                      <span className="font-medium">{a.alias}</span>
                      <span className="text-fk-muted"> → {acct?.nickname ?? "Account"}</span>
                      <span className="ml-1 text-[10px] text-fk-muted">({a.source})</span>
                    </span>
                    {a.source === "USER" && (
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => removeAlias(a.id)}>
                        Delete
                      </Button>
                    )}
                  </li>
                );
              })
            )}
          </ul>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder='Alias phrase, e.g. "main checking"'
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              className="h-9 flex-1 text-sm"
            />
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-9 rounded-md border border-fk-border bg-fk-charcoal px-2 text-sm"
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nickname}
                </option>
              ))}
            </select>
            <Button size="sm" className="h-9" onClick={addAlias} disabled={!newAlias.trim() || !accountId}>
              Add alias
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/utils/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ActivityEvent = {
  id: string;
  eventType: string;
  timestamp: string;
  description: string;
  source: string;
  amount?: number | string | null;
  previousBalance?: number | string | null;
  newBalance?: number | string | null;
  payee?: string | null;
  category?: string | null;
};

const FILTERS = [
  { id: "all", label: "All activity" },
  { id: "income", label: "Income" },
  { id: "spending", label: "Spending" },
  { id: "transfers", label: "Transfers" },
  { id: "balance", label: "Balance updates" },
  { id: "voice", label: "Voice updates" },
  { id: "imports", label: "Imports" },
];

export function AccountActivityTimeline({ accountId }: { accountId: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter });
      if (search) params.set("q", search);
      const res = await fetch(`/api/v1/accounts/${accountId}/activity?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [accountId, filter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Input
        placeholder="Search payee, amount, category…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && load()}
        className="h-9"
        aria-label="Search account activity"
      />

      {loading ? (
        <p className="text-sm text-fk-muted">Loading activity…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-fk-muted">No activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="rounded-lg border border-fk-border/50 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{e.description}</p>
                  {e.payee && <p className="text-xs text-fk-muted">{e.payee}</p>}
                </div>
                {e.amount != null && (
                  <span className="font-mono-amount tabular-nums">
                    {Number(e.amount) >= 0 ? "+" : ""}
                    {formatMoney(Number(e.amount))}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-fk-muted">
                <span>{new Date(e.timestamp).toLocaleDateString()}</span>
                <span>{e.source === "VOICE" ? "Voice update" : e.source}</span>
                {e.previousBalance != null && e.newBalance != null && (
                  <span>
                    Balance: {formatMoney(Number(e.previousBalance))} →{" "}
                    {formatMoney(Number(e.newBalance))}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
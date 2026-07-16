"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils/money";

const PRESETS = [
  { name: "Restaurants", amount: 150 },
  { name: "Movies", amount: 60 },
  { name: "Disneyland", amount: 650 },
  { name: "Monterey Car Week", amount: 2500 },
  { name: "LaGrange Road Trip", amount: 6500 },
  { name: "Vehicle Wrap", amount: 6000 },
  { name: "PL Advertising", amount: 500 },
  { name: "Vehicle Repairs", amount: 2000 },
];

interface AffordPageProps {
  accounts: { id: string; nickname: string }[];
}

export function AffordContent({ accounts }: AffordPageProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [result, setResult] = useState<{
    canAffordCash: boolean;
    recommendation: string;
    monthEndBuffer: number;
    yearEndBuffer: number;
    maxSafeBudget: number;
    warnings: string[];
    protectedReservesIntact: boolean;
    billsRemainFunded: boolean;
  } | null>(null);

  async function analyze() {
    const res = await fetch("/api/v1/engine/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, amount: parseFloat(amount), date, accountId }),
    });
    setResult(await res.json());
  }

  function applyPreset(p: { name: string; amount: number }) {
    setName(p.name);
    setAmount(String(p.amount));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Can I Afford It?</h1>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.name} variant="outline" size="sm" onClick={() => applyPreset(p)}>
            {p.name}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Purchase Analysis</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Item</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cost</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment account</Label>
              <select
                className="flex h-10 w-full rounded-md border border-fk-border bg-fk-charcoal px-3 text-sm"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.nickname}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={analyze}>Analyze</Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-fk-gold/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Recommendation
              <Badge variant={result.recommendation === "proceed" ? "success" : result.recommendation === "decline" ? "destructive" : "warning"}>
                {result.recommendation.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Can pay in cash: {result.canAffordCash ? "Yes" : "No"}</p>
            <p>Max safe budget: {formatMoney(result.maxSafeBudget)}</p>
            <p>Month-end buffer: {formatMoney(result.monthEndBuffer)}</p>
            <p>Year-end buffer: {formatMoney(result.yearEndBuffer)}</p>
            <p>Protected reserves intact: {result.protectedReservesIntact ? "Yes" : "No"}</p>
            <p>Bills remain funded: {result.billsRemainFunded ? "Yes" : "No"}</p>
            {result.warnings.map((w) => <p key={w} className="text-fk-risk-red">{w}</p>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

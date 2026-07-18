"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils/money";
import type { DailyProjection } from "@/lib/engine/types";
import { PageVoiceActions } from "@/components/voice/page-voice-actions";

interface CalendarPageProps {
  projections: DailyProjection[];
  accounts: { id: string; nickname: string }[];
}

const riskVariant: Record<string, "success" | "warning" | "destructive" | "outline"> = {
  GREEN: "success",
  YELLOW: "warning",
  ORANGE: "warning",
  RED: "destructive",
};

export function CalendarContent({ projections, accounts }: CalendarPageProps) {
  const [simAmount, setSimAmount] = useState("350");
  const [simDate, setSimDate] = useState(projections[5]?.date ?? "");
  const [simResult, setSimResult] = useState<{
    recommendation: string;
    monthEndBuffer: number;
    warnings: string[];
  } | null>(null);

  async function simulate() {
    const res = await fetch("/api/v1/engine/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Simulated expense",
        amount: parseFloat(simAmount),
        date: simDate,
        accountId: accounts[0]?.id,
      }),
    });
    const data = await res.json();
    setSimResult(data);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Financial Calendar</h1>
        <PageVoiceActions label="Record activity by voice" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Simulator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-fk-muted">
            What happens if I spend money on a given day?
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={simAmount} onChange={(e) => setSimAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={simDate} onChange={(e) => setSimDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={simulate}>Simulate</Button>
            </div>
          </div>
          {simResult && (
            <div className="rounded-lg border border-fk-border p-4">
              <Badge variant={simResult.recommendation === "proceed" ? "success" : simResult.recommendation === "decline" ? "destructive" : "warning"}>
                {simResult.recommendation.toUpperCase()}
              </Badge>
              <p className="mt-2 text-sm">Month-end buffer: {formatMoney(simResult.monthEndBuffer)}</p>
              {simResult.warnings.map((w) => (
                <p key={w} className="text-xs text-fk-risk-red">{w}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-4">
          {projections.slice(0, 30).map((day) => (
            <Card key={day.date} className="w-28 shrink-0">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-fk-muted">{day.date.slice(5)}</p>
                <Badge variant={riskVariant[day.riskLevel]} className="my-1">
                  {day.riskLevel}
                </Badge>
                <p className="font-mono-amount text-xs">{formatMoney(day.endingBalance, true)}</p>
                <p className="text-xs text-fk-gold">STS: {formatMoney(day.safeToSpend, true)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

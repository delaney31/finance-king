"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Crown, Shield } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/utils/money";
import type { DashboardSnapshot } from "@/lib/engine";

interface DashboardContentProps {
  dashboard: DashboardSnapshot;
  alerts: { id: string; title: string; message: string; severity: string }[];
  pendingUploads: number;
  upcomingBills: { id: string; name: string; amount: number }[];
  recommendation: { title: string; message: string; actionUrl: string | null } | null;
  accounts: { id: string; nickname: string; currentBalance: number; routingTag: string }[];
}

const riskColors: Record<string, string> = {
  GREEN: "risk-green",
  YELLOW: "risk-yellow",
  ORANGE: "risk-orange",
  RED: "risk-red",
};

export function DashboardContent({
  dashboard,
  alerts,
  pendingUploads,
  upcomingBills,
  recommendation,
  accounts,
}: DashboardContentProps) {
  const cashFlowData = Object.entries(
    dashboard.scenarios.find((s) => s.type === "BASE")?.monthlyEndingCash ?? {}
  )
    .slice(0, 6)
    .map(([month, cash]) => ({ month: month.slice(5), cash }));

  const utilizationPct = Math.round(dashboard.creditUtilization * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Command Center</h1>
          <p className="text-fk-muted">As of {dashboard.asOfDate}</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-fk-gold/30 bg-fk-gold/10 px-4 py-3">
          <Crown className="h-8 w-8 text-fk-gold" />
          <div>
            <p className="text-xs text-fk-muted">Financial Health (estimate)</p>
            <p className="text-2xl font-bold">{dashboard.healthScore.score}</p>
            <p className="text-xs text-fk-gold">{dashboard.healthScore.label}</p>
          </div>
        </div>
      </div>

      {dashboard.isProvisional && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTitle>Provisional data</AlertTitle>
          <AlertDescription>
            Some calculations use incomplete data: {dashboard.missingFields.join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {recommendation && (
        <Alert className="border-fk-gold/50 bg-fk-gold/10">
          <Shield className="h-4 w-4 text-fk-gold" />
          <AlertTitle>{recommendation.title}</AlertTitle>
          <AlertDescription>
            {recommendation.message}
            {recommendation.actionUrl && (
              <Link href={recommendation.actionUrl} className="ml-2 text-fk-gold underline">
                Take action
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Safe to Spend Today" value={dashboard.safeToSpend.today} variant="gold" isProvisional={dashboard.isProvisional} />
        <KpiCard title="Safe This Week" value={dashboard.safeToSpend.thisWeek} />
        <KpiCard title="Safe This Month" value={dashboard.safeToSpend.thisMonth} />
        <KpiCard title="Total Liquid Cash" value={dashboard.totalLiquidCash} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Protected Emergency" value={dashboard.protectedEmergency} variant="success" />
        <KpiCard title="Tax Reserve" value={dashboard.taxReserve} />
        <KpiCard title="Personal Operating" value={dashboard.personalOperatingCash} />
        <KpiCard title="Business Operating" value={dashboard.businessOperatingCash} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Debt" value={dashboard.totalDebt} variant="danger" />
        <KpiCard title="Month-End Buffer" value={dashboard.monthEndBuffer} />
        <KpiCard title="Year-End Buffer" value={dashboard.yearEndBuffer} />
        <KpiCard title="Year-End + ESOP" value={dashboard.yearEndBufferWithEsop ?? dashboard.yearEndBuffer} variant="gold" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Cash Flow (Base)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
                <XAxis dataKey="month" stroke="#8892a4" />
                <YAxis stroke="#8892a4" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ background: "#12182a", border: "1px solid #2a3142" }} />
                <Line type="monotone" dataKey="cash" stroke="#c9a227" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Credit Utilization
              <Badge variant={utilizationPct > 30 ? "destructive" : "success"}>{utilizationPct}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={utilizationPct} className="mb-4" />
            <p className="text-sm text-fk-muted">Target: below 30% for optimal credit profile</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overdraft Guardian — Next 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-7">
            {dashboard.sevenDayRisk.map((day) => (
              <div key={day.date} className="rounded-lg border border-fk-border p-3 text-center">
                <p className="text-xs text-fk-muted">{day.date.slice(5)}</p>
                <p className={`text-lg font-bold ${riskColors[day.riskLevel]}`}>●</p>
                <p className="font-mono-amount text-xs">{formatMoney(day.endingBalance, true)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Account Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts.filter((a) => a.currentBalance !== 0).map((a) => (
              <div key={a.id} className="flex justify-between text-sm">
                <span className="text-fk-muted">{a.nickname}</span>
                <span className="font-mono-amount">{formatMoney(a.currentBalance)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Bills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingBills.map((b) => (
              <div key={b.id} className="flex justify-between text-sm">
                <span className="text-fk-muted">{b.name}</span>
                <span className="font-mono-amount">{formatMoney(b.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scenarios — Year-End Buffer</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={dashboard.scenarios.map((s) => ({
                  name: s.type.slice(0, 4),
                  buffer: s.yearEndBufferWithEsop ?? s.yearEndBuffer,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
                <XAxis dataKey="name" stroke="#8892a4" />
                <YAxis stroke="#8892a4" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ background: "#12182a", border: "1px solid #2a3142" }} />
                <Bar dataKey="buffer" fill="#c9a227" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {(alerts.length > 0 || pendingUploads > 0) && (
        <div className="flex flex-wrap gap-3">
          {alerts.map((a) => (
            <Badge key={a.id} variant={a.severity === "CRITICAL" ? "destructive" : "warning"}>
              {a.title}
            </Badge>
          ))}
          {pendingUploads > 0 && (
            <Link href="/uploads">
              <Badge variant="outline">{pendingUploads} uploads need review</Badge>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

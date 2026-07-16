import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEngineSnapshot } from "@/lib/services/snapshot";
import { runAllScenarios } from "@/lib/engine";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ScenariosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const snapshot = await getEngineSnapshot(session.user.id);
  const scenarios = runAllScenarios(snapshot);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scenario Planning</h1>
      <p className="text-fk-muted">
        Compare conservative, base, and strong projections. ESOP shown as optional upside in Strong scenario.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {scenarios.map((s) => (
          <Card key={s.type} className={s.type === "STRONG" ? "border-fk-gold/40" : ""}>
            <CardHeader>
              <CardTitle>{s.type}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-fk-muted">Safe to spend (month)</span>
                <span className="font-mono-amount">{formatMoney(s.safeToSpendMonth)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fk-muted">Emergency reserve</span>
                <span className="font-mono-amount">{formatMoney(s.emergencyReserve)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fk-muted">Tax reserve</span>
                <span className="font-mono-amount">{formatMoney(s.taxReserve)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fk-muted">Debt balance</span>
                <span className="font-mono-amount">{formatMoney(s.debtBalance)}</span>
              </div>
              <div className="flex justify-between border-t border-fk-border pt-2">
                <span className="font-medium">Year-end buffer</span>
                <span className="font-mono-amount font-semibold">{formatMoney(s.yearEndBuffer)}</span>
              </div>
              {s.yearEndBufferWithEsop !== undefined && (
                <div className="flex justify-between text-fk-gold">
                  <span>With ESOP upside</span>
                  <span className="font-mono-amount">{formatMoney(s.yearEndBufferWithEsop)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

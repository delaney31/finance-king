"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

const STEPS = ["Profile", "Accounts", "Income", "Bills & Expenses", "Goals", "Confirm"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    household: "",
    monthlySpendingTarget: "6000",
    emergencyFundGoal: "40000",
    taxReserveGoal: "30000",
    creditScoreGoal: "800",
    debtFreeDate: "",
  });

  async function completeOnboarding() {
    setLoading(true);
    await fetch("/api/v1/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    router.push("/dashboard");
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-fk-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-2">
          <Crown className="h-8 w-8 text-fk-gold" />
          <h1 className="text-2xl font-bold">Setup Wizard</h1>
        </div>

        <Progress value={progress} className="mb-6" />
        <div className="mb-6 flex justify-between text-xs text-fk-muted">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? "text-fk-gold" : ""}>{s}</span>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step]}</CardTitle>
            <CardDescription>Step {step + 1} of {STEPS.length}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label>Your name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Household name</Label>
                  <Input value={form.household} onChange={(e) => setForm({ ...form, household: e.target.value })} placeholder="Delaney Household" />
                </div>
              </>
            )}

            {step === 1 && (
              <p className="text-fk-muted">
                Add your accounts in the Accounts section after setup, or use the demo seed data.
                Include checking, savings, credit cards, and business accounts with routing tags.
              </p>
            )}

            {step === 2 && (
              <p className="text-fk-muted">
                Enter income sources with expected dates. W-2 → PenFed, contracts → Truist (65% operating, 35% tax),
                Turo → Mercury, NY rent → Wells Fargo.
              </p>
            )}

            {step === 3 && (
              <div className="space-y-2">
                <Label>Monthly spending target</Label>
                <Input type="number" value={form.monthlySpendingTarget} onChange={(e) => setForm({ ...form, monthlySpendingTarget: e.target.value })} />
              </div>
            )}

            {step === 4 && (
              <>
                <div className="space-y-2">
                  <Label>Emergency fund goal</Label>
                  <Input type="number" value={form.emergencyFundGoal} onChange={(e) => setForm({ ...form, emergencyFundGoal: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tax reserve goal</Label>
                  <Input type="number" value={form.taxReserveGoal} onChange={(e) => setForm({ ...form, taxReserveGoal: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Credit score goal</Label>
                  <Input type="number" value={form.creditScoreGoal} onChange={(e) => setForm({ ...form, creditScoreGoal: e.target.value })} />
                </div>
              </>
            )}

            {step === 5 && (
              <div className="space-y-3 text-sm">
                <p>Review your setup:</p>
                <ul className="list-inside list-disc space-y-1 text-fk-muted">
                  <li>Name: {form.name || "—"}</li>
                  <li>Household: {form.household || "—"}</li>
                  <li>Emergency goal: ${form.emergencyFundGoal}</li>
                  <li>Tax reserve goal: ${form.taxReserveGoal}</li>
                  <li>Monthly spending target: ${form.monthlySpendingTarget}</li>
                </ul>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(step + 1)}>Continue</Button>
              ) : (
                <Button onClick={completeOnboarding} disabled={loading}>
                  {loading ? "Saving..." : "Complete Setup"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

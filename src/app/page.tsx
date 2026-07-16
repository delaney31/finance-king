import Link from "next/link";
import { Crown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-fk-background">
      <header className="border-b border-fk-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Crown className="h-7 w-7 text-fk-gold" />
            <span className="text-xl font-semibold">Finance King</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-fk-gold/30 bg-fk-gold/10 px-4 py-1 text-sm text-fk-gold">
            <Shield className="h-4 w-4" />
            Private wealth-management dashboard
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Rule your finances
            <span className="block text-fk-gold">like a king</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-fk-muted">
            Know exactly how much cash you have, what is committed, what is protected,
            and what you can safely spend — every single day.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">Start your kingdom</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in to dashboard</Link>
            </Button>
          </div>
        </div>

        <div className="mt-24 grid gap-6 md:grid-cols-3">
          {[
            { title: "Safe to Spend", desc: "Real-time calculation excluding protected reserves, bills, and commitments." },
            { title: "Overdraft Guardian", desc: "90-day balance forecasting with escalating risk alerts." },
            { title: "Scenario Planning", desc: "Conservative, base, and strong projections with optional ESOP upside." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-fk-border bg-fk-card p-6">
              <h3 className="text-lg font-semibold text-fk-gold">{f.title}</h3>
              <p className="mt-2 text-sm text-fk-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

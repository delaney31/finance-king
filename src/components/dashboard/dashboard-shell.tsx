import { Crown } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-fk-background">
      <DashboardNav />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-fk-border px-4 md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <Crown className="h-5 w-5 text-fk-gold" />
            <span className="font-semibold">Finance King</span>
          </div>
          <p className="hidden text-sm text-fk-muted md:block">
            Your financial command center
          </p>
        </header>
        <main className="flex-1 overflow-auto p-4 pb-24 md:p-8 md:pb-8">{children}</main>
      </div>
    </div>
  );
}

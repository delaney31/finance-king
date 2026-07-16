import { Crown } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { AskMyCfoProvider } from "@/components/cfo/ask-my-cfo-provider";
import { AskMyCfoPanel, AskMyCfoButton } from "@/components/cfo/ask-my-cfo-panel";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AskMyCfoProvider>
      <div className="flex min-h-screen bg-fk-background">
        <DashboardNav />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="flex h-16 items-center justify-between border-b border-fk-border px-4 md:px-8">
            <div className="flex items-center gap-2 md:hidden">
              <Crown className="h-5 w-5 text-fk-gold" />
              <span className="font-semibold">Finance King</span>
            </div>
            <p className="hidden text-sm text-fk-muted md:block">
              Your financial command center
            </p>
            <AskMyCfoButton />
          </header>
          <div className="flex flex-1 min-h-0">
            <main className="flex-1 overflow-auto p-4 pb-24 md:p-8 md:pb-8 min-w-0">{children}</main>
            <AskMyCfoPanel />
          </div>
        </div>
      </div>
    </AskMyCfoProvider>
  );
}

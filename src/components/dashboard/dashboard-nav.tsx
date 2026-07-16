"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CreditCard,
  Crown,
  FileUp,
  LayoutDashboard,
  LineChart,
  Moon,
  Settings,
  ShoppingBag,
  Sun,
  Target,
  Wallet,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/transactions", label: "Transactions", icon: LineChart },
  { href: "/uploads", label: "Uploads", icon: FileUp },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/bills", label: "Bills", icon: Target },
  { href: "/credit", label: "Credit", icon: CreditCard },
  { href: "/scenarios", label: "Scenarios", icon: LineChart },
  { href: "/can-i-afford-it", label: "Afford It", icon: ShoppingBag },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = (resolvedTheme ?? theme) === "dark";
  const themeIcon = !mounted ? (
    <Moon className="h-4 w-4" />
  ) : isDark ? (
    <Sun className="h-4 w-4" />
  ) : (
    <Moon className="h-4 w-4" />
  );

  return (
    <>
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-fk-border md:bg-fk-navy/50">
        <div className="flex h-16 items-center gap-2 border-b border-fk-border px-6">
          <Crown className="h-6 w-6 text-fk-gold" />
          <span className="text-lg font-semibold">Finance King</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-fk-gold/20 text-fk-gold"
                    : "text-fk-muted hover:bg-fk-charcoal hover:text-fk-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-fk-border p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="w-full justify-start"
          >
            {themeIcon}
            Toggle theme
          </Button>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-fk-border bg-fk-navy/95 backdrop-blur md:hidden">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                active ? "text-fk-gold" : "text-fk-muted"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

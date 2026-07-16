"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { formatMoney, formatMoneyKpi } from "@/lib/utils/money";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CalculationLine } from "@/lib/financial-state/types";

interface KpiCardProps {
  title: string;
  value: number;
  subtitle?: string;
  variant?: "default" | "gold" | "success" | "warning" | "danger";
  isProvisional?: boolean;
  calculationLines?: CalculationLine[];
  metricKey?: string;
}

const variantStyles = {
  default: "border-fk-border",
  gold: "border-fk-gold/40 bg-fk-gold/5",
  success: "border-fk-safe-green/40",
  warning: "border-yellow-500/40",
  danger: "border-fk-risk-red/40",
};

export function KpiCard({
  title,
  value,
  subtitle,
  variant = "default",
  isProvisional,
  calculationLines,
  metricKey,
}: KpiCardProps) {
  const [showCalc, setShowCalc] = useState(false);
  const lines =
    calculationLines?.filter((l) => l.metric === metricKey) ??
    calculationLines?.filter((l) => l.label.toLowerCase().includes(title.toLowerCase().slice(0, 8))) ??
    [];

  return (
    <Card
      className={cn(
        "@container kpi-card flex min-h-[190px] min-w-0 flex-col overflow-visible",
        variantStyles[variant]
      )}
    >
      <CardHeader className="shrink-0 space-y-2 p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium leading-snug text-fk-muted">{title}</CardTitle>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCalc((v) => !v)}
              className="shrink-0 rounded p-1 text-fk-muted hover:bg-fk-charcoal hover:text-fk-foreground"
              aria-label={`How ${title} is calculated`}
              title="How calculated"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {isProvisional && (
          <Badge variant="warning" className="w-fit text-[10px]">
            Provisional
          </Badge>
        )}
      </CardHeader>
      <CardContent className="mt-auto flex min-w-0 flex-1 flex-col justify-end p-4 pt-0">
        <p
          className="kpi-value font-mono-amount font-semibold leading-none tabular-nums text-[clamp(1.25rem,10cqw,2rem)]"
          title={formatMoney(value)}
        >
          {formatMoneyKpi(value)}
        </p>
        {subtitle && <p className="mt-1.5 text-xs text-fk-muted">{subtitle}</p>}
        {showCalc && lines.length > 0 && (
          <div className="mt-3 border-t border-fk-border/50 pt-2 text-xs">
            <p className="mb-1 font-medium text-fk-muted">How calculated</p>
            <ul className="space-y-0.5">
              {lines.map((line, i) => (
                <li key={i} className="flex justify-between gap-2 text-fk-muted">
                  <span className="min-w-0 truncate">{line.label}</span>
                  <span className="shrink-0 tabular-nums text-fk-foreground">
                    {formatMoney(line.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

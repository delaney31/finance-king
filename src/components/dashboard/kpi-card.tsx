import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface KpiCardProps {
  title: string;
  value: number;
  subtitle?: string;
  variant?: "default" | "gold" | "success" | "warning" | "danger";
  isProvisional?: boolean;
}

const variantStyles = {
  default: "border-fk-border",
  gold: "border-fk-gold/40 bg-fk-gold/5",
  success: "border-fk-safe-green/40",
  warning: "border-yellow-500/40",
  danger: "border-fk-risk-red/40",
};

export function KpiCard({ title, value, subtitle, variant = "default", isProvisional }: KpiCardProps) {
  return (
    <Card className={cn("kpi-card", variantStyles[variant])}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-fk-muted">{title}</CardTitle>
          {isProvisional && <Badge variant="warning">Provisional</Badge>}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="font-mono-amount text-2xl font-semibold md:text-3xl">{formatMoney(value)}</p>
        {subtitle && <p className="mt-1 text-xs text-fk-muted">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

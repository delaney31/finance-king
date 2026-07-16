import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-fk-gold/20 text-fk-gold",
        secondary: "border-transparent bg-fk-charcoal text-fk-foreground",
        destructive: "border-transparent bg-fk-risk-red/20 text-fk-risk-red",
        success: "border-transparent bg-fk-safe-green/20 text-fk-safe-green",
        outline: "text-fk-foreground border-fk-border",
        warning: "border-transparent bg-yellow-500/20 text-yellow-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

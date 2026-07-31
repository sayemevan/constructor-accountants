import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
        secondary:
          "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700",
        success:
          "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
        warning:
          "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
        destructive:
          "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30",
        outline: "text-zinc-950 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700",
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
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

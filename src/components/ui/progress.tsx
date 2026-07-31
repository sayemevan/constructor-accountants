import * as React from "react";
import { cn } from "@/utils/cn";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  indicatorColor?: string;
}

export function Progress({ value, className, indicatorColor = "bg-amber-500", ...props }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, value));

  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800",
        className
      )}
      {...props}
    >
      <div
        className={cn("h-full transition-all duration-300 ease-in-out", indicatorColor)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

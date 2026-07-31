import React from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/utils/cn";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  iconBgColor?: string;
  iconTextColor?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  change,
  isPositive = true,
  icon: Icon,
  iconBgColor = "bg-amber-500/10 dark:bg-amber-500/20",
  iconTextColor = "text-amber-500",
}: StatCardProps) {
  return (
    <Card className="hover:border-amber-500/30 transition-all">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {title}
          </span>
          <div className={cn("p-2 rounded-lg", iconBgColor, iconTextColor)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <h4 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {value}
          </h4>

          {change && (
            <div
              className={cn(
                "flex items-center text-xs font-semibold px-2 py-0.5 rounded-full",
                isPositive
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                  : "text-red-600 dark:text-red-400 bg-red-500/10"
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              <span>{change}</span>
            </div>
          )}
        </div>

        {subtitle && (
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

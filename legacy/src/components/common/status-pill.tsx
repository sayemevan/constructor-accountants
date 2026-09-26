import React from "react";
import { Badge } from "@/components/ui/badge";
import { ProjectStatus } from "@/types/project";

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  switch (status) {
    case "running":
      return (
        <Badge variant="warning" className="capitalize">
          ● Running
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="success" className="capitalize">
          ✓ Completed
        </Badge>
      );
    case "planning":
      return (
        <Badge variant="secondary" className="capitalize">
          ○ Planning
        </Badge>
      );
    case "on_hold":
      return (
        <Badge variant="destructive" className="capitalize">
          ⏸ On Hold
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function TransactionTypePill({ type }: { type: string }) {
  switch (type) {
    case "income":
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          + Income
        </span>
      );
    case "expense":
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
          - Expense
        </span>
      );
    case "subcontractor_payout":
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          Subcontractor
        </span>
      );
    case "material_purchase":
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          Materials
        </span>
      );
    default:
      return <span className="text-xs font-medium px-2 py-0.5">{type}</span>;
  }
}

"use client";

import React from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ProjectStatusPill } from "@/components/common/status-pill";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import { formatDate } from "@/utils/formatters";
import {
  Building2,
  Users,
  Wallet,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  User,
  Eye,
  History,
} from "lucide-react";
import type { ConstructionProject } from "@/types/project";
import type { SiteWorker } from "@/types/worker";
import type { Transaction } from "@/types/transaction";

/**
 * Read-only dashboard shown to invited clients. It shows only what a client
 * needs: the project cost, the amount they've paid, the remaining amount and the
 * total number of site workers per project. Contractor-only figures (profit,
 * revenue, accounts) are never shown.
 */
export function CollaboratorDashboard() {
  const { projects, workers, transactions } = useData();
  const { formatCurrency } = useSettings();

  const projectCost = (project: ConstructionProject): number => {
    if (project.totalExpense > 0) return project.totalExpense;
    // Legacy shared sheets may not carry a header total — derive it from the data.
    const txCost = transactions
      .filter((t: Transaction) => t.projectId === project.id && t.type !== "income")
      .reduce((acc, t) => acc + t.amount, 0);
    const laborCost = workers
      .filter((w: SiteWorker) => w.projectId === project.id)
      .reduce((acc, w) => acc + (w.totalPaidOut ?? 0), 0);
    return txCost + laborCost;
  };

  const workerCount = (projectId: string) =>
    workers.filter((w) => w.projectId === projectId).length;

  // The client's payments = income transactions recorded against the project.
  const paymentHistory = (projectId: string) =>
    transactions
      .filter((t) => t.projectId === projectId && t.type === "income")
      .sort((a, b) => b.date.localeCompare(a.date));

  const totalCost = projects.reduce((acc, p) => acc + projectCost(p), 0);
  const totalPaid = projects.reduce((acc, p) => acc + p.amountReceived, 0);
  const totalRemaining = projects.reduce((acc, p) => acc + p.remainingBalance, 0);

  return (
    <div className="space-y-8 animate-in fade-in-50">
      <PageHeader
        title="Project Overview"
        description="A read-only view of the projects that have been shared with you"
      />

      {/* Shared access callout */}
      <div className="p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-emerald-500 text-slate-950 shrink-0">
          <Eye className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Shared with you
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            View your project cost, the amount you&apos;ve paid, the remaining balance and the
            number of workers on site.
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Project Cost"
          value={formatCurrency(totalCost)}
          subtitle="Across all shared projects"
          icon={Wallet}
          iconBgColor="bg-red-500/10"
          iconTextColor="text-red-500"
        />
        <StatCard
          title="Amount Paid"
          value={formatCurrency(totalPaid)}
          subtitle="Payments received so far"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-500/10"
          iconTextColor="text-emerald-500"
        />
        <StatCard
          title="Remaining Amount"
          value={formatCurrency(totalRemaining)}
          subtitle="Balance still due"
          icon={Clock}
          iconBgColor="bg-amber-500/10"
          iconTextColor="text-amber-500"
        />
        <StatCard
          title="Total Site Workers"
          value={`${workers.length}`}
          subtitle={`${projects.length} shared project${projects.length === 1 ? "" : "s"}`}
          icon={Users}
          iconBgColor="bg-blue-500/10"
          iconTextColor="text-blue-500"
        />
      </div>

      {/* Project details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Project Details</CardTitle>
          <CardDescription>Everything shared with you, at a glance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.length === 0 && (
            <p className="text-xs text-zinc-400 py-6 text-center">
              No shared projects yet. Open a project shared with you to see it here.
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {project.code && (
                      <span className="text-[10px] font-mono font-medium text-amber-600 dark:text-amber-400">
                        {project.code}
                      </span>
                    )}
                    <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center mt-0.5">
                      <Building2 className="h-4 w-4 mr-1.5 text-amber-500 shrink-0" />
                      <span className="truncate">{project.name}</span>
                    </h4>
                    {project.address && (
                      <span className="text-[11px] text-zinc-500 flex items-center mt-1">
                        <MapPin className="h-3 w-3 mr-1 text-zinc-400 shrink-0" />
                        <span className="truncate">{project.address}</span>
                      </span>
                    )}
                  </div>
                  <ProjectStatusPill status={project.status} />
                </div>

                {/* Cost, worker count and remaining balance */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block">Project Cost</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                      {formatCurrency(projectCost(project))}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block">Site Workers</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                      {workerCount(project.id)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-semibold">
                      Remaining
                    </span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                      {formatCurrency(project.remainingBalance)}
                    </span>
                  </div>
                </div>

                {/* Amount paid — as a dated payment history */}
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/20">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center">
                      <History className="h-3.5 w-3.5 mr-1.5" />
                      Payment History
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Paid: {formatCurrency(project.amountReceived)}
                    </span>
                  </div>

                  {paymentHistory(project.id).length === 0 ? (
                    <p className="px-3 py-3 text-[11px] text-zinc-400 text-center">
                      No individual payments recorded yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-emerald-500/10 max-h-40 overflow-y-auto">
                      {paymentHistory(project.id).map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-zinc-700 dark:text-zinc-200">
                                {formatDate(p.date)}
                              </span>
                              {(p.description || p.payeeOrPayer) && (
                                <span className="text-[10px] text-zinc-400 truncate">
                                  {p.description || p.payeeOrPayer}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                            {formatCurrency(p.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-500 pt-1">
                  <div className="flex items-center space-x-1">
                    <User className="h-3 w-3 text-amber-500 shrink-0" />
                    <span className="truncate">{project.manager || project.ownerName || "—"}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3 text-amber-500 shrink-0" />
                    <span>Start: {formatDate(project.startDate)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>End: {formatDate(project.estimatedCompletion)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

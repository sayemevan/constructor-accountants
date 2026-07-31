"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { FinancialCharts } from "@/features/dashboard/financial-charts";
import { CollaboratorDashboard } from "@/features/dashboard/collaborator-dashboard";
import { TransactionDialog } from "@/features/transactions/transaction-dialog";
import { ProjectDialog } from "@/features/projects/project-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProjectStatusPill, TransactionTypePill } from "@/components/common/status-pill";
import { useData } from "@/providers/data-provider";
import { useGoogleAuth } from "@/providers/google-auth-provider";
import { useSettings } from "@/providers/settings-provider";
import { formatDate } from "@/utils/formatters";
import {
  Plus,
  DollarSign,
  TrendingUp,
  Building2,
  Receipt,
  ArrowRight,
  ShieldCheck,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { projects, transactions } = useData();
  const { workspaceMode } = useGoogleAuth();
  const { formatCurrency } = useSettings();
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  // Invited collaborators/clients get a restricted, read-only dashboard.
  if (workspaceMode === "collaborator") {
    return <CollaboratorDashboard />;
  }

  // Compute stat card metrics
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type !== "income").reduce((acc, t) => acc + t.amount, 0);
  const netProfit = totalIncome - totalExpense;

  return (
    <div className="space-y-8 animate-in fade-in-50">
      {/* Top Page Header */}
      <PageHeader
        title="Financial Executive Dashboard"
        description="Real-time contractor ledger overview synced with your Google Drive & Sheets"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setProjectDialogOpen(true)}
          className="text-xs"
        >
          <Building2 className="h-4 w-4 mr-1 text-amber-500" />
          <span>New Project</span>
        </Button>

        <Button
          size="sm"
          onClick={() => setTransactionDialogOpen(true)}
          className="text-xs shadow-md shadow-amber-500/20"
        >
          <Plus className="h-4 w-4 mr-1" />
          <span>Record Transaction</span>
        </Button>
      </PageHeader>

      {/* Google Data Storage Callout Banner */}
      <div className="p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-amber-500 text-slate-950 font-bold shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              100% Contractor Data Ownership
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Connected to Google Drive folder: <span className="font-mono text-amber-600 dark:text-amber-400">Construction Keeper</span>. No vendor lock-in or backend database.
            </p>
          </div>
        </div>
        <Link href="/settings">
          <Button variant="outline" size="sm" className="text-xs shrink-0">
            <FolderOpen className="h-3.5 w-3.5 mr-1 text-amber-500" />
            Manage Google Storage
          </Button>
        </Link>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue (Billed)"
          value={formatCurrency(totalIncome)}
          change="+14.2%"
          isPositive={true}
          subtitle="From active project milestones"
          icon={DollarSign}
          iconBgColor="bg-emerald-500/10"
          iconTextColor="text-emerald-500"
        />

        <StatCard
          title="Total Outflow / Cost"
          value={formatCurrency(totalExpense)}
          change="-3.8%"
          isPositive={false}
          subtitle="Materials, labor & sub-contractors"
          icon={Receipt}
          iconBgColor="bg-red-500/10"
          iconTextColor="text-red-500"
        />

        <StatCard
          title="Net Operating Margin"
          value={formatCurrency(netProfit)}
          change="+22.5%"
          isPositive={true}
          subtitle="Gross profit before retainage"
          icon={TrendingUp}
          iconBgColor="bg-amber-500/10"
          iconTextColor="text-amber-500"
        />

        <StatCard
          title="Active Construction Sites"
          value={`${projects.filter((p) => p.status === "running").length} Running`}
          subtitle="All projects stored in Google Drive"
          icon={Building2}
          iconBgColor="bg-blue-500/10"
          iconTextColor="text-blue-500"
        />
      </div>

      {/* Visual Analytics Section */}
      <FinancialCharts />

      {/* Content Grid: Active Projects Progress & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects Budget Health */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Active Projects Budget</CardTitle>
              <CardDescription>Contract value vs expense</CardDescription>
            </div>
            <Link href="/projects" className="text-xs text-amber-500 hover:underline flex items-center">
              <span>View All</span>
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-5">
            {projects.length === 0 && (
              <p className="text-xs text-zinc-400 py-4 text-center">No projects yet.</p>
            )}
            {projects.slice(0, 3).map((project) => {
              const spentPercent = project.contractValue
                ? Math.round((project.totalExpense / project.contractValue) * 100)
                : 0;
              return (
                <div key={project.id} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
                        {project.name}
                      </span>
                      <span className="text-[10px] text-zinc-500">{project.ownerName}</span>
                    </div>
                    <ProjectStatusPill status={project.status} />
                  </div>

                  <Progress value={spentPercent} indicatorColor={spentPercent > 90 ? "bg-red-500" : "bg-amber-500"} />

                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Expense: {formatCurrency(project.totalExpense)}</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      Contract: {formatCurrency(project.contractValue)} ({spentPercent}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Ledger Entries */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Ledger Entries</CardTitle>
              <CardDescription>Recorded in your personal Google Sheet ledger</CardDescription>
            </div>
            <Link href="/transactions" className="text-xs text-amber-500 hover:underline flex items-center">
              <span>Full Ledger</span>
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-2.5 px-2">TX #</th>
                    <th className="py-2.5 px-2">Date</th>
                    <th className="py-2.5 px-2">Project & Payee</th>
                    <th className="py-2.5 px-2">Type</th>
                    <th className="py-2.5 px-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-zinc-400">
                        No ledger entries yet.
                      </td>
                    </tr>
                  )}
                  {transactions.slice(0, 5).map((tx) => (
                    <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 px-2 font-mono font-medium text-zinc-600 dark:text-zinc-400">
                        {tx.transactionNo}
                      </td>
                      <td className="py-3 px-2 text-zinc-500">{formatDate(tx.date)}</td>
                      <td className="py-3 px-2">
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{tx.payeeOrPayer}</span>
                          <span className="text-[10px] text-zinc-400">{tx.projectName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <TransactionTypePill type={tx.type} />
                      </td>
                      <td
                        className={`py-3 px-2 text-right font-semibold ${
                          tx.type === "income" ? "text-emerald-500" : "text-zinc-900 dark:text-zinc-100"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction & Project Dialog Modals */}
      <TransactionDialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen} />
      <ProjectDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen} />
    </div>
  );
}

"use client";

import React from "react";
import { PageHeader } from "@/components/common/page-header";
import { FinancialCharts } from "@/features/dashboard/financial-charts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useData } from "@/providers/data-provider";
import { useGoogleAuth } from "@/providers/google-auth-provider";
import { useSettings } from "@/providers/settings-provider";
import { FileSpreadsheet, Printer, Calendar } from "lucide-react";

export default function ReportsPage() {
  const { transactions } = useData();
  const { workspaceMode } = useGoogleAuth();
  const isCollaborator = workspaceMode === "collaborator";
  const { formatCurrency } = useSettings();

  const revenue = transactions.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
  const expenseByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === "income") continue;
    expenseByCategory.set(tx.category, (expenseByCategory.get(tx.category) ?? 0) + tx.amount);
  }
  const totalExpense = Array.from(expenseByCategory.values()).reduce((a, v) => a + v, 0);
  const netProfit = revenue - totalExpense;
  const margin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title={isCollaborator ? "Project Cost Report" : "Financial Reports & Analytics"}
        description={
          isCollaborator
            ? "Project spend breakdown by category, from the shared project ledger"
            : "Comprehensive Profit & Loss, Site Budget Variance, and Retainage statement generation"
        }
      >
        <Button variant="outline" size="sm" className="text-xs">
          <Printer className="h-4 w-4 mr-1 text-zinc-500" />
          <span>Print PDF</span>
        </Button>
        {!isCollaborator && (
          <Button size="sm" className="text-xs shadow-md shadow-amber-500/20">
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            <span>Export Google Sheet</span>
          </Button>
        )}
      </PageHeader>

      {/* Date Range & Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] text-xs">
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-zinc-600 dark:text-zinc-400">
          <Calendar className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Reporting Period:</span>
          <span>Fiscal Year 2026 (Jan 1, 2026 - Dec 31, 2026)</span>
        </div>

        <select className="h-8 w-full sm:w-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100">
          <option value="ytd">Year to Date (YTD)</option>
          <option value="q2">Q2 2026</option>
          <option value="q1">Q1 2026</option>
          <option value="fy25">FY 2025</option>
        </select>
      </div>

      <FinancialCharts hideIncome={isCollaborator} />

      {/* Summary Statement — Profit & Loss for owners, cost-only for collaborators */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isCollaborator ? "Project Cost Summary" : "Profit & Loss Summary Statement"}
          </CardTitle>
          <CardDescription>
            {isCollaborator
              ? "Total project spend by category, from the shared project ledger"
              : "Calculated dynamically from contractor ledger"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs">
            {!isCollaborator && (
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100">
                <span>Gross Contract Billings (Revenue)</span>
                <span className="text-emerald-500">{formatCurrency(revenue)}</span>
              </div>
            )}
            <div className="pl-4 space-y-1 text-zinc-500">
              {Array.from(expenseByCategory.entries()).length === 0 && (
                <div className="text-zinc-400">No expenses recorded yet.</div>
              )}
              {Array.from(expenseByCategory.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => (
                  <div key={category} className="flex justify-between">
                    <span>- {category}</span>
                    <span>{formatCurrency(amount)}</span>
                  </div>
                ))}
            </div>

            {isCollaborator ? (
              <div className="flex justify-between py-2 border-t border-b border-zinc-200 dark:border-zinc-800 font-bold text-sm text-zinc-900 dark:text-zinc-50 pt-3">
                <span>Total Project Cost</span>
                <span className="text-amber-500">{formatCurrency(totalExpense)}</span>
              </div>
            ) : (
              <div className="flex justify-between py-2 border-t border-b border-zinc-200 dark:border-zinc-800 font-bold text-sm text-zinc-900 dark:text-zinc-50 pt-3">
                <span>Net Operating Profit</span>
                <span className="text-amber-500">
                  {formatCurrency(netProfit)} ({margin}%)
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

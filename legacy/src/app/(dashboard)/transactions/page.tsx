"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { TransactionTypePill } from "@/components/common/status-pill";
import { TransactionDialog } from "@/features/transactions/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import { formatDate } from "@/utils/formatters";
import { Plus, Search, FileSpreadsheet, CheckCircle2 } from "lucide-react";

export default function TransactionsPage() {
  const { transactions, projects } = useData();
  const { formatCurrency } = useSettings();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.transactionNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.payeeOrPayer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    const matchesProject = projectFilter === "all" || tx.projectId === projectFilter;
    return matchesSearch && matchesType && matchesProject;
  });

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Transaction Ledger"
        description="Comprehensive site financial log directly written to your Google Sheet master workbook"
      >
        <Button onClick={() => setDialogOpen(true)} className="text-xs shadow-md shadow-amber-500/20">
          <Plus className="h-4 w-4 mr-1" />
          <span>Record Transaction</span>
        </Button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215]">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400" />
            <Input
              placeholder="Search payee, description, TX#..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100 w-full sm:w-auto"
          >
            <option value="all">All Transaction Types</option>
            <option value="income">Income / Billing</option>
            <option value="expense">Site Expense</option>
            <option value="subcontractor_payout">Subcontractor Payout</option>
            <option value="material_purchase">Material Purchase</option>
          </select>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100 w-full sm:w-auto"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2 text-xs text-zinc-500">
          <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
          <span>Synced to &quot;Transactions&quot; sheet tab</span>
        </div>
      </div>

      {/* Ledger Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="p-3">TX No.</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Project</th>
                  <th className="p-3">Type & Category</th>
                  <th className="p-3">Payee / Payer</th>
                  <th className="p-3">Account</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-zinc-400">
                      No transactions recorded yet. Use &quot;Record Transaction&quot; to add your first ledger entry.
                    </td>
                  </tr>
                )}
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                    <td className="p-3 font-mono font-medium text-amber-600 dark:text-amber-400">
                      {tx.transactionNo}
                    </td>
                    <td className="p-3 text-zinc-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100 max-w-[160px] truncate">
                      {tx.projectName}
                    </td>
                    <td className="p-3 space-y-1">
                      <TransactionTypePill type={tx.type} />
                      <div className="text-[10px] text-zinc-400">{tx.category}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{tx.payeeOrPayer}</span>
                        <span className="text-[10px] text-zinc-400 truncate max-w-[200px]">{tx.description}</span>
                      </div>
                    </td>
                    <td className="p-3 text-zinc-500">{tx.accountName}</td>
                    <td className="p-3">
                      <Badge variant="success" className="text-[10px] py-0">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {tx.status}
                      </Badge>
                    </td>
                    <td
                      className={`p-3 text-right font-bold text-sm ${
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

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

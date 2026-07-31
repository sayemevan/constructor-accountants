"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * @param hideIncome when true, hides the income series/revenue (used for the
 *   collaborator/client view, which should only see project spend, not revenue).
 */
export function FinancialCharts({ hideIncome = false }: { hideIncome?: boolean }) {
  const { transactions } = useData();
  const { currencySymbol } = useSettings();

  // Monthly income vs expense, derived from the transaction ledger.
  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const tx of transactions) {
    const d = new Date(tx.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const entry = byMonth.get(key) ?? { income: 0, expense: 0 };
    if (tx.type === "income") entry.income += tx.amount;
    else entry.expense += tx.amount;
    byMonth.set(key, entry);
  }
  const monthlyCashFlow = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({ month: MONTH_LABELS[Number(key.split("-")[1])] ?? key, ...val }));

  // Expense breakdown by category (non-income transactions).
  const byCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === "income") continue;
    byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount);
  }
  const categoryExpenses = Array.from(byCategory.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Monthly Cash Flow Area Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{hideIncome ? "Monthly Project Spend (2026)" : "Cash Flow Overview (2026)"}</CardTitle>
          <CardDescription>
            {hideIncome
              ? "Expenses tracked in the shared project sheet"
              : "Income vs. Expenses tracked in contractor Google Sheet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyCashFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} tickFormatter={(val) => `${currencySymbol}${val / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#27272a",
                    borderRadius: "8px",
                    color: "#f4f4f5",
                    fontSize: "12px",
                  }}
                  // @ts-ignore recharts tooltip type signature
                  formatter={(value: any) => [`${currencySymbol}${Number(value || 0).toLocaleString()}`, ""]}
                />
                {!hideIncome && (
                  <Area type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#incomeGrad)" />
                )}
                <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#expenseGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Breakdown Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Categories</CardTitle>
          <CardDescription>Current month spend breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryExpenses} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <XAxis type="number" stroke="#71717a" fontSize={10} tickFormatter={(val) => `${currencySymbol}${val / 1000}k`} />
                <YAxis dataKey="category" type="category" stroke="#71717a" fontSize={11} width={90} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#27272a",
                    borderRadius: "8px",
                    color: "#f4f4f5",
                    fontSize: "12px",
                  }}
                  // @ts-ignore recharts tooltip type signature
                  formatter={(val: any) => [`${currencySymbol}${Number(val || 0).toLocaleString()}`, "Spend"]}
                />
                <Bar dataKey="amount" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { AccountDialog } from "@/features/accounts/account-dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import { Landmark, CreditCard, Wallet, Plus, RefreshCcw, ShieldCheck } from "lucide-react";

export default function AccountsPage() {
  const { accounts } = useData();
  const { formatCurrency } = useSettings();
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Payment & Liquidity Accounts"
        description="Manage contractor business checking, cash vaults, and vendor supply lines synced with Google Sheets"
      >
        <Button onClick={() => setDialogOpen(true)} className="text-xs shadow-md shadow-amber-500/20">
          <Plus className="h-4 w-4 mr-1" />
          <span>Add Account</span>
        </Button>
      </PageHeader>

      {accounts.length === 0 && (
        <div className="p-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
          No payment accounts yet.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {accounts.map((acc) => (
          <Card key={acc.id} className="hover:border-amber-500/40 transition-all flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
                  {acc.type === "bank" ? (
                    <Landmark className="h-5 w-5" />
                  ) : acc.type === "vendor_credit" ? (
                    <CreditCard className="h-5 w-5" />
                  ) : (
                    <Wallet className="h-5 w-5" />
                  )}
                </div>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  {acc.type.replace("_", " ")}
                </Badge>
              </div>

              <CardTitle className="text-base mt-3">{acc.name}</CardTitle>
              <CardDescription className="font-mono text-xs">{acc.accountNumberMasked}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <div>
                <span className="text-[11px] text-zinc-500">Current Balance</span>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(acc.balance)}
                </div>
              </div>

              <div className="text-xs text-zinc-500">
                Institution: <strong className="text-zinc-700 dark:text-zinc-300">{acc.institution}</strong>
              </div>
            </CardContent>

            <CardFooter className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3 text-[11px] text-zinc-400 justify-between">
              <span className="flex items-center">
                <ShieldCheck className="h-3 w-3 mr-1 text-emerald-500" />
                Sheet Synced
              </span>
              <button className="hover:text-amber-500 transition-colors flex items-center">
                <RefreshCcw className="h-3 w-3 mr-1" />
                Reconcile
              </button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <AccountDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

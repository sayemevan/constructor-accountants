"use client";

import React, { useState } from "react";
import { SiteWorker, WorkerPayment } from "@/types/worker";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/utils/formatters";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import {
  HardHat,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Building2,
  Receipt,
  UserX,
  Plus,
  CheckCircle2,
  History,
} from "lucide-react";

interface WorkerDetailsDialogProps {
  worker: SiteWorker | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkerUpdated: (updated: SiteWorker) => void;
}

export function WorkerDetailsDialog({ worker, open, onOpenChange, onWorkerUpdated }: WorkerDetailsDialogProps) {
  const { updateWorker, recordWorkerPayment, accounts } = useData();
  const { formatCurrency, currencySymbol } = useSettings();
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [daysWorked, setDaysWorked] = useState(10);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Bank Transfer" | "Check">("Bank Transfer");
  const [accountName, setAccountName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!worker) return null;

  const handleDeactivate = async () => {
    const updated: SiteWorker = { ...worker, status: "deactivated" };
    setSubmitting(true);
    try {
      await updateWorker(updated);
      onWorkerUpdated(updated);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const payoutAmount = daysWorked * worker.dailyWage;
    const newPayment: WorkerPayment = {
      id: `wpay_${Date.now()}`,
      workerId: worker.id,
      date: new Date().toISOString().split("T")[0],
      amount: payoutAmount,
      daysWorked: daysWorked,
      paymentMethod: paymentMethod,
      transactionNo: `TX-W-${Math.floor(100 + Math.random() * 900)}`,
      notes: `Payout for ${daysWorked} days worked at ${currencySymbol}${worker.dailyWage}/day`,
      accountName: accountName || undefined,
    };

    setSubmitting(true);
    try {
      const updatedWorker = await recordWorkerPayment(worker, newPayment);
      onWorkerUpdated(updatedWorker);
      setShowPayoutForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
              <HardHat className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg">{worker.name}</DialogTitle>
              <DialogDescription className="text-xs flex items-center mt-0.5">
                <Building2 className="h-3.5 w-3.5 mr-1 text-amber-500" />
                <span>{worker.projectName}</span>
              </DialogDescription>
            </div>
          </div>
          <Badge
            variant={
              worker.status === "active"
                ? "success"
                : worker.status === "deactivated"
                ? "destructive"
                : "secondary"
            }
            className="capitalize text-xs"
          >
            {worker.status}
          </Badge>
        </div>
      </DialogHeader>

      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Profile Attributes Card */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs">
          <div className="flex items-center space-x-2">
            <Phone className="h-3.5 w-3.5 text-amber-500" />
            <span>{worker.phone}</span>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin className="h-3.5 w-3.5 text-amber-500" />
            <span className="truncate">{worker.address}</span>
          </div>
          <div className="flex items-center space-x-2">
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
            <span>Daily Wage: <strong>{formatCurrency(worker.dailyWage)}/day</strong></span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-3.5 w-3.5 text-amber-500" />
            <span>Joined: {formatDate(worker.joiningDate)}</span>
          </div>
        </div>

        {/* Payout Summary Cards */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">Total Paid Out</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(worker.totalPaidOut || 0)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">Total Days Worked</span>
            <span className="text-base font-bold text-amber-600 dark:text-amber-400">
              {worker.totalDaysWorked || 0} Days
            </span>
          </div>
        </div>

        {/* Record Payout Inline Toggle */}
        {showPayoutForm ? (
          <form onSubmit={handleAddPayment} className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
              <span>Record Worker Wage Payout</span>
              <button type="button" onClick={() => setShowPayoutForm(false)} className="text-[10px] underline">
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                  Days Worked
                </label>
                <Input
                  type="number"
                  value={daysWorked}
                  onChange={(e) => setDaysWorked(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-2 text-xs"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                Paid From Account
              </label>
              <select
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-2 text-xs"
              >
                <option value="">Select account (optional)...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                    {a.institution ? ` (${a.institution})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-zinc-500">Calculated Payout: <strong>{formatCurrency(daysWorked * worker.dailyWage)}</strong></span>
              <Button type="submit" size="sm" disabled={submitting} className="h-7 text-xs">
                {submitting ? "Saving..." : "Submit Payout to Sheet"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center">
              <History className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              <span>Worker Payment History</span>
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAccountName(accounts[0]?.name ?? "");
                setShowPayoutForm(true);
              }}
              disabled={worker.status === "deactivated"}
              className="text-xs h-7"
            >
              <Plus className="h-3 w-3 mr-1 text-emerald-500" />
              <span>Record Wage Payout</span>
            </Button>
          </div>
        )}

        {/* Worker Payment History Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="p-2.5">TX #</th>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Days</th>
                <th className="p-2.5">Method</th>
                <th className="p-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-[11px]">
              {worker.payments && worker.payments.length > 0 ? (
                worker.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <td className="p-2.5 font-mono text-amber-600 dark:text-amber-400">{p.transactionNo}</td>
                    <td className="p-2.5 text-zinc-500">{formatDate(p.date)}</td>
                    <td className="p-2.5 text-zinc-700 dark:text-zinc-300 font-medium">{p.daysWorked} Days</td>
                    <td className="p-2.5 text-zinc-500">{p.paymentMethod}</td>
                    <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-400">
                    No payment history recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DialogFooter className="pt-2 flex justify-between sm:justify-between w-full">
        {worker.status !== "deactivated" ? (
          <Button variant="ghost" size="sm" onClick={handleDeactivate} disabled={submitting} className="text-xs text-red-500 hover:text-red-600">
            <UserX className="h-3.5 w-3.5 mr-1" />
            Deactivate Worker
          </Button>
        ) : (
          <span className="text-xs text-red-500 font-semibold flex items-center">
            ● Deactivated Worker Profile
          </span>
        )}

        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

"use client";

import React from "react";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import { ConstructionProject } from "@/types/project";
import { Transaction } from "@/types/transaction";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HandCoins } from "lucide-react";

interface ReceivePaymentDialogProps {
  project: ConstructionProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const today = () => new Date().toISOString().split("T")[0];

export function ReceivePaymentDialog({ project, open, onOpenChange }: ReceivePaymentDialogProps) {
  const { accounts, addTransaction } = useData();
  const { currencySymbol, formatCurrency } = useSettings();

  const [date, setDate] = React.useState(today());
  const [amount, setAmount] = React.useState<string>("");
  const [payer, setPayer] = React.useState("");
  const [accountName, setAccountName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Reset the form whenever a different project is opened.
  React.useEffect(() => {
    if (open && project) {
      setDate(today());
      setAmount("");
      setPayer(project.ownerName ?? "");
      setAccountName("");
      setNote("");
      setError(null);
    }
  }, [open, project]);

  if (!project) return null;

  const numericAmount = Number(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }

    const transaction: Transaction = {
      id: `tx_${Date.now()}`,
      transactionNo: `RCP-${Math.floor(1000 + Math.random() * 9000)}`,
      date,
      projectId: project.id,
      projectName: project.name,
      type: "income",
      category: "Client Invoice",
      amount: numericAmount,
      payeeOrPayer: payer || project.ownerName || "Client",
      accountName,
      status: "cleared",
      description: note || "Payment received",
    };

    try {
      setSaving(true);
      await addTransaction(transaction);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  };

  const newRemaining =
    project.contractValue > 0
      ? Math.max(0, project.contractValue - project.amountReceived - (numericAmount > 0 ? numericAmount : 0))
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <HandCoins className="h-5 w-5 text-emerald-500" />
          <span>Receive Payment</span>
        </DialogTitle>
        <DialogDescription>
          Record a client payment for <strong>{project.name}</strong>. Saves directly to the project&apos;s Google Sheet.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Amount ({currencySymbol})
            </label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Date Received
            </label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Received From
            </label>
            <Input
              placeholder="Client name"
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Deposited To
            </label>
            <select
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-zinc-100"
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
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
            Note (optional)
          </label>
          <Input
            placeholder="e.g. 2nd installment for foundation work"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-3 text-xs">
          <div>
            <span className="text-[10px] text-zinc-400 block">Already Paid</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(project.amountReceived)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 block">This Payment</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(numericAmount > 0 ? numericAmount : 0)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 block">Remaining</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {project.contractValue > 0 ? formatCurrency(newRemaining) : "—"}
            </span>
          </div>
        </div>

        {error && <p className="text-[11px] text-red-500">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

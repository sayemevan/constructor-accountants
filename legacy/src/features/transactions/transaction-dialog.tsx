"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionSchema, TransactionFormValues } from "@/utils/validators";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import { Transaction } from "@/types/transaction";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, UploadCloud } from "lucide-react";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitSuccess?: (values: TransactionFormValues) => void;
}

export function TransactionDialog({ open, onOpenChange, onSubmitSuccess }: TransactionDialogProps) {
  const { projects, accounts, addTransaction } = useData();
  const { currencySymbol } = useSettings();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    // @ts-ignore zodResolver coerce type matching
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      type: "expense",
      category: "Building Materials",
      amount: 500,
      payeeOrPayer: "",
      projectId: "",
      accountName: "",
      description: "",
    },
  });

  const handleFormSubmit = async (data: any) => {
    const vals = data as TransactionFormValues;
    const project = projects.find((p) => p.id === vals.projectId);

    const transaction: Transaction = {
      id: `tx_${Date.now()}`,
      transactionNo: `TX-${Math.floor(1000 + Math.random() * 9000)}`,
      date: vals.date,
      projectId: vals.projectId,
      projectName: project?.name ?? "",
      type: vals.type,
      category: vals.category as Transaction["category"],
      amount: vals.amount,
      payeeOrPayer: vals.payeeOrPayer,
      accountName: vals.accountName,
      status: "cleared",
      description: vals.description,
    };

    await addTransaction(transaction);
    if (onSubmitSuccess) onSubmitSuccess(vals);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <DollarSign className="h-5 w-5 text-amber-500" />
          <span>Record Construction Transaction</span>
        </DialogTitle>
        <DialogDescription>
          Saves directly to your Google Sheet with optional Drive receipt upload.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Transaction Type
            </label>
            <select
              {...register("type")}
              className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
            >
              <option value="income">Income / Client Billing</option>
              <option value="expense">General Site Expense</option>
              <option value="subcontractor_payout">Subcontractor Payout</option>
              <option value="material_purchase">Material Purchase</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Date
            </label>
            <Input type="date" {...register("date")} />
            {errors.date && <p className="text-[10px] text-red-500 mt-1">{errors.date.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Construction Project
            </label>
            <select
              {...register("projectId")}
              className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.projectId && <p className="text-[10px] text-red-500 mt-1">{errors.projectId.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Category
            </label>
            <select
              {...register("category")}
              className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
            >
              <option value="Client Invoice">Client Invoice</option>
              <option value="Building Materials">Building Materials</option>
              <option value="Subcontractor Fee">Subcontractor Fee</option>
              <option value="Labor / Payroll">Labor / Payroll</option>
              <option value="Equipment Rental">Equipment Rental</option>
              <option value="Permits & Licenses">Permits & Licenses</option>
              <option value="Utilities & Site Overhead">Utilities & Site Overhead</option>
              <option value="Misc">Misc</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Amount ({currencySymbol})
            </label>
            <Input type="number" step="0.01" placeholder="0.00" {...register("amount")} />
            {errors.amount && <p className="text-[10px] text-red-500 mt-1">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Payee / Payer
            </label>
            <Input placeholder="Vendor, Subcontractor, or Client" {...register("payeeOrPayer")} />
            {errors.payeeOrPayer && <p className="text-[10px] text-red-500 mt-1">{errors.payeeOrPayer.message}</p>}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
            Payment Account
          </label>
          <select
            {...register("accountName")}
            className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
          >
            <option value="">Select account...</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name}
                {a.institution ? ` (${a.institution})` : ""}
              </option>
            ))}
          </select>
          {errors.accountName && <p className="text-[10px] text-red-500 mt-1">{errors.accountName.message}</p>}
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
            Description / Line Items
          </label>
          <Input placeholder="e.g. 50 bags cement delivery for foundation" {...register("description")} />
          {errors.description && <p className="text-[10px] text-red-500 mt-1">{errors.description.message}</p>}
        </div>

        <div className="p-3 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/40">
          <div className="flex items-center space-x-2 text-xs text-zinc-500">
            <UploadCloud className="h-4 w-4 text-amber-500" />
            <span>Attach Receipt to Google Drive</span>
          </div>
          <Button type="button" variant="outline" size="sm" className="text-xs h-7">
            Browse
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            Save to Google Sheet
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

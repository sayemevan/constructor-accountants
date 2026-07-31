"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { accountSchema, AccountFormValues } from "@/utils/validators";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import { Account } from "@/types/account";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Landmark } from "lucide-react";

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitSuccess?: (account: Account) => void;
}

export function AccountDialog({ open, onOpenChange, onSubmitSuccess }: AccountDialogProps) {
  const { addAccount } = useData();
  const { currency, currencies } = useSettings();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    // @ts-ignore zodResolver coerce type matching
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: "bank",
      institution: "",
      accountNumberMasked: "",
      balance: 0,
      currency: currency,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: "",
        type: "bank",
        institution: "",
        accountNumberMasked: "",
        balance: 0,
        currency: currency,
      });
    }
  }, [open, currency, reset]);

  const handleFormSubmit = async (data: any) => {
    const vals = data as AccountFormValues;

    const account: Account = {
      id: `acc_${Date.now()}`,
      name: vals.name,
      type: vals.type,
      accountNumberMasked: vals.accountNumberMasked ?? "",
      balance: vals.balance,
      currency: vals.currency,
      institution: vals.institution ?? "",
      lastSynced: new Date().toISOString(),
    };

    await addAccount(account);
    if (onSubmitSuccess) onSubmitSuccess(account);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <Landmark className="h-5 w-5 text-amber-500" />
          <span>Add Payment Account</span>
        </DialogTitle>
        <DialogDescription>
          Saves a new liquidity account row directly into your Google Sheet ledger.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Account Name
            </label>
            <Input placeholder="e.g. Business Checking" {...register("name")} />
            {errors.name && <p className="text-[10px] text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Account Type
            </label>
            <select
              {...register("type")}
              className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
            >
              <option value="bank">Bank</option>
              <option value="cash_on_hand">Cash on Hand</option>
              <option value="vendor_credit">Vendor Credit</option>
              <option value="petty_cash">Petty Cash</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Institution
            </label>
            <Input placeholder="e.g. City Bank, N/A for cash" {...register("institution")} />
            {errors.institution && <p className="text-[10px] text-red-500 mt-1">{errors.institution.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Account Number (Masked)
            </label>
            <Input placeholder="e.g. **** 4321" {...register("accountNumberMasked")} />
            {errors.accountNumberMasked && (
              <p className="text-[10px] text-red-500 mt-1">{errors.accountNumberMasked.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Current Balance
            </label>
            <Input type="number" step="0.01" placeholder="0.00" {...register("balance")} />
            {errors.balance && <p className="text-[10px] text-red-500 mt-1">{errors.balance.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Currency
            </label>
            <select
              {...register("currency")}
              className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} — {c.code}
                </option>
              ))}
            </select>
            {errors.currency && <p className="text-[10px] text-red-500 mt-1">{errors.currency.message}</p>}
          </div>
        </div>

        <DialogFooter className="pt-2">
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

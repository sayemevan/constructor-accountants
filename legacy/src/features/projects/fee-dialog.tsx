"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { feeSchema, FeeFormValues } from "@/utils/validators";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import { ConstructionProject } from "@/types/project";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calculator, Ruler, Coins } from "lucide-react";

interface FeeDialogProps {
  project: ConstructionProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeeDialog({ project, open, onOpenChange }: FeeDialogProps) {
  const { updateProject } = useData();
  const { currencySymbol, formatCurrency } = useSettings();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<FeeFormValues>({
    // @ts-ignore zodResolver coerce type matching
    resolver: zodResolver(feeSchema),
    defaultValues: {
      feeMode: "total",
      contractValue: 0,
      areaSqFt: 0,
      ratePerSqFt: 0,
      includeMaterial: false,
      materialCost: 0,
      includeArchitect: false,
      architectCost: 0,
    },
  });

  useEffect(() => {
    if (!open || !project) return;
    reset({
      feeMode: project.feeMode ?? "total",
      contractValue: project.contractValue || 0,
      areaSqFt: project.areaSqFt || 0,
      ratePerSqFt: project.ratePerSqFt || 0,
      includeMaterial: (project.materialCost || 0) > 0,
      materialCost: project.materialCost || 0,
      includeArchitect: (project.architectCost || 0) > 0,
      architectCost: project.architectCost || 0,
    });
  }, [open, project, reset]);

  const feeMode = watch("feeMode");
  const area = Number(watch("areaSqFt")) || 0;
  const rate = Number(watch("ratePerSqFt")) || 0;
  const lumpSum = Number(watch("contractValue")) || 0;
  const includeMaterial = watch("includeMaterial");
  const materialCost = Number(watch("materialCost")) || 0;
  const includeArchitect = watch("includeArchitect");
  const architectCost = Number(watch("architectCost")) || 0;

  const computedFee = feeMode === "per_sqft" ? area * rate : lumpSum;
  const amountPaid = project?.amountReceived ?? 0;
  const remaining = Math.max(0, computedFee - amountPaid);

  if (!project) return null;

  const handleFormSubmit = async () => {
    const material = includeMaterial ? materialCost : 0;
    const architect = includeArchitect ? architectCost : 0;
    const updated: ConstructionProject = {
      ...project,
      feeMode,
      areaSqFt: feeMode === "per_sqft" ? area : undefined,
      ratePerSqFt: feeMode === "per_sqft" ? rate : undefined,
      contractValue: computedFee,
      materialCost: material,
      architectCost: architect,
      remainingBalance: remaining,
    };
    await updateProject(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <Calculator className="h-5 w-5 text-amber-500" />
          <span>Construction Fee</span>
        </DialogTitle>
        <DialogDescription>
          Set the total construction fee for <strong>{project.name}</strong>. Leave it at 0 if it
          hasn&apos;t been decided yet — you can calculate it later.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* Fee mode selector */}
        <div>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1.5">
            How is the fee calculated?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer text-xs has-[:checked]:border-amber-500 has-[:checked]:bg-amber-500/10">
              <input type="radio" value="total" {...register("feeMode")} className="accent-amber-500" />
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              <span>Lump-sum total</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer text-xs has-[:checked]:border-amber-500 has-[:checked]:bg-amber-500/10">
              <input type="radio" value="per_sqft" {...register("feeMode")} className="accent-amber-500" />
              <Ruler className="h-3.5 w-3.5 text-amber-500" />
              <span>Per square foot</span>
            </label>
          </div>
        </div>

        {feeMode === "total" ? (
          <div>
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
              Total Construction Fee ({currencySymbol})
            </label>
            <Input type="number" step="0.01" min="0" {...register("contractValue")} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                Area (sq ft)
              </label>
              <Input type="number" step="0.01" min="0" {...register("areaSqFt")} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                Rate per sq ft ({currencySymbol})
              </label>
              <Input type="number" step="0.01" min="0" {...register("ratePerSqFt")} />
            </div>
          </div>
        )}

        {/* Optional material cost */}
        <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-3">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input type="checkbox" {...register("includeMaterial")} className="accent-amber-500" />
            <span>Include material cost</span>
            <span className="text-[10px] text-zinc-400 font-normal">
              (optional — clients often supply materials)
            </span>
          </label>
          {includeMaterial && (
            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                Estimated Material Cost ({currencySymbol})
              </label>
              <Input type="number" step="0.01" min="0" {...register("materialCost")} />
            </div>
          )}
        </div>

        {/* Optional architect fee */}
        <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-3">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input type="checkbox" {...register("includeArchitect")} className="accent-amber-500" />
            <span>Include architect fee</span>
            <span className="text-[10px] text-zinc-400 font-normal">
              (optional — the client may handle their own architectural design)
            </span>
          </label>
          {includeArchitect ? (
            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                Architect Fee ({currencySymbol})
              </label>
              <Input type="number" step="0.01" min="0" {...register("architectCost")} />
            </div>
          ) : (
            <p className="text-[10px] text-zinc-400">
              Client provides their own architectural design — no architect fee is charged.
            </p>
          )}
        </div>

        {/* Live summary */}
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Total Construction Fee</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-50 text-sm">
              {formatCurrency(computedFee)}
            </span>
          </div>
          {feeMode === "per_sqft" && (
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>{area.toLocaleString()} sq ft × {formatCurrency(rate)}/sq ft</span>
            </div>
          )}
          {includeMaterial && materialCost > 0 && (
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Material cost</span>
              <span>{formatCurrency(materialCost)}</span>
            </div>
          )}
          {includeArchitect && architectCost > 0 && (
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Architect fee</span>
              <span>{formatCurrency(architectCost)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Amount Paid (from payments)</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(amountPaid)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-amber-500/20 pt-2">
            <span className="text-zinc-500">Remaining</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            Save Fee
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

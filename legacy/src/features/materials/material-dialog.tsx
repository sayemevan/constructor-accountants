"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { materialSchema, MaterialFormValues } from "@/utils/validators";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import { MaterialItem } from "@/types/material";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package } from "lucide-react";

interface MaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitSuccess?: (material: MaterialItem) => void;
}

const DEFAULTS: MaterialFormValues = {
  projectId: "",
  itemCode: "",
  name: "",
  category: "Concrete & Masonry",
  unit: "bags",
  unitPrice: 0,
  quantityInStock: 0,
  reorderLevel: 0,
  supplier: "",
  lastPurchasedDate: new Date().toISOString().split("T")[0],
};

export function MaterialDialog({ open, onOpenChange, onSubmitSuccess }: MaterialDialogProps) {
  const { addMaterial, projects } = useData();
  const { currencySymbol } = useSettings();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MaterialFormValues>({
    // @ts-ignore zodResolver coerce type matching
    resolver: zodResolver(materialSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) {
      reset({ ...DEFAULTS, lastPurchasedDate: new Date().toISOString().split("T")[0] });
    }
  }, [open, reset]);

  const handleFormSubmit = async (data: any) => {
    const vals = data as MaterialFormValues;
    const project = projects.find((p) => p.id === vals.projectId);

    const material: MaterialItem = {
      id: `mat_${Date.now()}`,
      projectId: vals.projectId,
      projectName: project?.name ?? "",
      itemCode: vals.itemCode,
      name: vals.name,
      category: vals.category,
      unit: vals.unit,
      unitPrice: vals.unitPrice,
      quantityInStock: vals.quantityInStock,
      reorderLevel: vals.reorderLevel,
      supplier: vals.supplier,
      lastPurchasedDate: vals.lastPurchasedDate,
    };

    await addMaterial(material);
    if (onSubmitSuccess) onSubmitSuccess(material);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <Package className="h-5 w-5 text-amber-500" />
          <span>Add Material Log</span>
        </DialogTitle>
        <DialogDescription>
          Adds a new inventory item row directly into your Google Sheet ledger.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Item Code
            </label>
            <Input placeholder="e.g. MAT-001" {...register("itemCode")} />
            {errors.itemCode && <p className="text-[10px] text-red-500 mt-1">{errors.itemCode.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Material Name
            </label>
            <Input placeholder="e.g. Portland Cement" {...register("name")} />
            {errors.name && <p className="text-[10px] text-red-500 mt-1">{errors.name.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Category
            </label>
            <select
              {...register("category")}
              className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
            >
              <option value="Concrete & Masonry">Concrete & Masonry</option>
              <option value="Steel & Rebar">Steel & Rebar</option>
              <option value="Lumber & Carpentry">Lumber & Carpentry</option>
              <option value="Electrical">Electrical</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Finishes">Finishes</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Unit
            </label>
            <select
              {...register("unit")}
              className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
            >
              <option value="tons">tons</option>
              <option value="bags">bags</option>
              <option value="pcs">pcs</option>
              <option value="sq_ft">sq_ft</option>
              <option value="linear_ft">linear_ft</option>
              <option value="gallons">gallons</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Unit Price ({currencySymbol})
            </label>
            <Input type="number" step="0.01" placeholder="0.00" {...register("unitPrice")} />
            {errors.unitPrice && <p className="text-[10px] text-red-500 mt-1">{errors.unitPrice.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Quantity in Stock
            </label>
            <Input type="number" step="0.01" placeholder="0" {...register("quantityInStock")} />
            {errors.quantityInStock && (
              <p className="text-[10px] text-red-500 mt-1">{errors.quantityInStock.message}</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Reorder Level
            </label>
            <Input type="number" step="0.01" placeholder="0" {...register("reorderLevel")} />
            {errors.reorderLevel && (
              <p className="text-[10px] text-red-500 mt-1">{errors.reorderLevel.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Supplier
            </label>
            <Input placeholder="e.g. BuildMart Supplies" {...register("supplier")} />
            {errors.supplier && <p className="text-[10px] text-red-500 mt-1">{errors.supplier.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Last Purchased Date
            </label>
            <Input type="date" {...register("lastPurchasedDate")} />
            {errors.lastPurchasedDate && (
              <p className="text-[10px] text-red-500 mt-1">{errors.lastPurchasedDate.message}</p>
            )}
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

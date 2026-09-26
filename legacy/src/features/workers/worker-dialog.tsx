"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { workerSchema, WorkerFormValues } from "@/utils/validators";
import { SiteWorker } from "@/types/worker";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HardHat } from "lucide-react";

interface WorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerToEdit?: SiteWorker | null;
  onSubmitSuccess?: (worker: SiteWorker) => void;
}

export function WorkerDialog({ open, onOpenChange, workerToEdit, onSubmitSuccess }: WorkerDialogProps) {
  const { projects, addWorker, updateWorker } = useData();
  const { currencySymbol } = useSettings();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WorkerFormValues>({
    // @ts-ignore Zod coerce type mapping
    resolver: zodResolver(workerSchema),
    defaultValues: {
      name: "",
      phone: "+1 (555) 000-0000",
      address: "",
      trade: "Mason",
      dailyWage: 180,
      joiningDate: new Date().toISOString().split("T")[0],
      status: "active",
      projectId: "",
    },
  });

  useEffect(() => {
    if (workerToEdit) {
      setValue("name", workerToEdit.name);
      setValue("phone", workerToEdit.phone);
      setValue("address", workerToEdit.address);
      setValue("trade", workerToEdit.trade);
      setValue("dailyWage", workerToEdit.dailyWage);
      setValue("joiningDate", workerToEdit.joiningDate);
      setValue("status", workerToEdit.status);
      setValue("projectId", workerToEdit.projectId);
    } else {
      reset({
        name: "",
        phone: "+1 (555) 000-0000",
        address: "",
        trade: "Mason",
        dailyWage: 180,
        joiningDate: new Date().toISOString().split("T")[0],
        status: "active",
        projectId: "",
      });
    }
  }, [workerToEdit, setValue, reset, open]);

  const handleFormSubmit = async (data: any) => {
    const vals = data as WorkerFormValues;
    const selectedPrj = projects.find((p) => p.id === vals.projectId);
    const projectName = selectedPrj ? selectedPrj.name : "";

    const workerObj: SiteWorker = {
      id: workerToEdit ? workerToEdit.id : `wrk_${Date.now()}`,
      name: vals.name,
      phone: vals.phone,
      address: vals.address,
      trade: vals.trade,
      dailyWage: vals.dailyWage,
      joiningDate: vals.joiningDate,
      status: vals.status,
      projectId: vals.projectId,
      projectName: projectName,
      totalDaysWorked: workerToEdit?.totalDaysWorked || 0,
      totalPaidOut: workerToEdit?.totalPaidOut || 0,
      payments: workerToEdit?.payments || [],
    };

    if (workerToEdit) {
      await updateWorker(workerObj);
    } else {
      await addWorker(workerObj);
    }

    if (onSubmitSuccess) onSubmitSuccess(workerObj);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <HardHat className="h-5 w-5 text-amber-500" />
          <span>{workerToEdit ? "Edit Site Worker Profile" : "Add New Site Worker"}</span>
        </DialogTitle>
        <DialogDescription>
          Every worker belongs to one project. Profile and wage data is saved directly in your Google Sheet.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Worker Full Name
            </label>
            <Input placeholder="e.g. Robert Martinez" {...register("name")} />
            {errors.name && <p className="text-[10px] text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Phone Number
            </label>
            <Input placeholder="+1 (555) 000-0000" {...register("phone")} />
            {errors.phone && <p className="text-[10px] text-red-500 mt-1">{errors.phone.message}</p>}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
            Residential Address
          </label>
          <Input placeholder="Street Address, City" {...register("address")} />
          {errors.address && <p className="text-[10px] text-red-500 mt-1">{errors.address.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Trade Specialty
            </label>
            <select
              {...register("trade")}
              className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
            >
              <option value="Mason">Mason</option>
              <option value="Carpenter">Carpenter</option>
              <option value="Electrician">Electrician</option>
              <option value="Plumber">Plumber</option>
              <option value="Steel Fixer">Steel Fixer</option>
              <option value="Painter">Painter</option>
              <option value="Welder">Welder</option>
              <option value="General Laborer">General Laborer</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Daily Wage ({currencySymbol}/day)
            </label>
            <Input type="number" step="0.01" placeholder="180" {...register("dailyWage")} />
            {errors.dailyWage && <p className="text-[10px] text-red-500 mt-1">{errors.dailyWage.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Joining Date
            </label>
            <Input type="date" {...register("joiningDate")} />
            {errors.joiningDate && <p className="text-[10px] text-red-500 mt-1">{errors.joiningDate.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Worker Status
            </label>
            <select
              {...register("status")}
              className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
            Assigned Construction Project
          </label>
          <select
            {...register("projectId")}
            className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
          >
            <option value="">Select project...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          {errors.projectId && <p className="text-[10px] text-red-500 mt-1">{errors.projectId.message}</p>}
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {workerToEdit ? "Save Worker Changes" : "Add Worker to Google Sheet"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

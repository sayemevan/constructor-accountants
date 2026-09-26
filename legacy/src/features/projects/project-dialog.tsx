"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, ProjectFormValues } from "@/utils/validators";
import { useData } from "@/providers/data-provider";
import { ConstructionProject } from "@/types/project";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Info } from "lucide-react";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectToEdit?: ConstructionProject | null;
  onSubmitSuccess?: (values: ProjectFormValues) => void;
}

const CREATE_DEFAULTS: ProjectFormValues = {
  name: "",
  code: "PRJ-2026-06",
  ownerName: "",
  address: "",
  startDate: "2026-08-01",
  estimatedCompletion: "",
  status: "running",
  manager: "",
  notes: "",
};

export function ProjectDialog({ open, onOpenChange, projectToEdit, onSubmitSuccess }: ProjectDialogProps) {
  const { addProject, updateProject } = useData();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    // @ts-ignore zodResolver coerce type matching
    resolver: zodResolver(projectSchema),
    defaultValues: CREATE_DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    if (projectToEdit) {
      reset({
        name: projectToEdit.name,
        code: projectToEdit.code,
        ownerName: projectToEdit.ownerName,
        address: projectToEdit.address,
        startDate: projectToEdit.startDate,
        estimatedCompletion: projectToEdit.estimatedCompletion,
        status: projectToEdit.status,
        manager: projectToEdit.manager,
        notes: projectToEdit.notes ?? "",
      });
    } else {
      reset(CREATE_DEFAULTS);
    }
  }, [open, projectToEdit, reset]);

  const handleFormSubmit = async (data: any) => {
    const formVals = data as ProjectFormValues;

    if (projectToEdit) {
      // Preserve identity, financials and per-project links on edit — the fee
      // and billing are managed separately (Construction Fee + transactions).
      const updated: ConstructionProject = {
        ...projectToEdit,
        code: formVals.code,
        name: formVals.name,
        ownerName: formVals.ownerName,
        address: formVals.address,
        startDate: formVals.startDate,
        estimatedCompletion: formVals.estimatedCompletion ?? "",
        status: formVals.status,
        manager: formVals.manager,
        clientName: formVals.ownerName,
        notes: formVals.notes,
      };
      await updateProject(updated);
    } else {
      // Financials start empty — the construction fee is calculated later and
      // costs/payments are derived from transactions and site workers.
      const project: ConstructionProject = {
        id: `prj_${Date.now()}`,
        code: formVals.code,
        name: formVals.name,
        ownerName: formVals.ownerName,
        address: formVals.address,
        startDate: formVals.startDate,
        estimatedCompletion: formVals.estimatedCompletion ?? "",
        status: formVals.status,
        contractValue: 0,
        amountReceived: 0,
        remainingBalance: 0,
        totalExpense: 0,
        laborCost: 0,
        materialCost: 0,
        architectCost: 0,
        currentProfit: 0,
        manager: formVals.manager,
        clientName: formVals.ownerName,
        notes: formVals.notes,
      };
      await addProject(project);
    }

    if (onSubmitSuccess) onSubmitSuccess(formVals);
    reset(CREATE_DEFAULTS);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <Building2 className="h-5 w-5 text-amber-500" />
          <span>{projectToEdit ? "Edit Construction Project" : "New Construction Project"}</span>
        </DialogTitle>
        <DialogDescription>
          {projectToEdit
            ? "Updates this project's row in your Google Sheet master ledger."
            : "Create the project first — set the construction fee later from the project card."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* Project Basic Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Project Name
            </label>
            <Input placeholder="e.g. House A or Office Building" {...register("name")} />
            {errors.name && <p className="text-[10px] text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Project Code / ID
            </label>
            <Input placeholder="PRJ-2026-06" {...register("code")} />
            {errors.code && <p className="text-[10px] text-red-500 mt-1">{errors.code.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Owner / Client Name
            </label>
            <Input placeholder="Owner / Client Entity" {...register("ownerName")} />
            {errors.ownerName && <p className="text-[10px] text-red-500 mt-1">{errors.ownerName.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Project Status
            </label>
            <select
              {...register("status")}
              className="w-full h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
            >
              <option value="planning">Planning</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
            Project Address
          </label>
          <Input placeholder="Full Site Street Address" {...register("address")} />
          {errors.address && <p className="text-[10px] text-red-500 mt-1">{errors.address.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Start Date
            </label>
            <Input type="date" {...register("startDate")} />
            {errors.startDate && <p className="text-[10px] text-red-500 mt-1">{errors.startDate.message}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Estimated Completion Date <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <Input type="date" {...register("estimatedCompletion")} />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
            Site Manager / Lead Engineer
          </label>
          <Input placeholder="Manager Name" {...register("manager")} />
          {errors.manager && <p className="text-[10px] text-red-500 mt-1">{errors.manager.message}</p>}
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
            Notes <span className="text-zinc-400 font-normal">(optional)</span>
          </label>
          <Input placeholder="Any project notes" {...register("notes")} />
        </div>

        {!projectToEdit && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
            <span>
              No billing or costing here. After creating the project, use{" "}
              <strong className="text-zinc-700 dark:text-zinc-200">Construction Fee</strong> on the
              project card to set the total fee (lump sum or per sq ft). Costs and payments are
              tracked from transactions and site workers.
            </span>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {projectToEdit ? "Save Project Changes" : "Create Project"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

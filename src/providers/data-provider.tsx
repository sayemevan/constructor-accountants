"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useGoogleAuth } from "@/providers/google-auth-provider";
import { GoogleSheetsService } from "@/services/google-sheets.service";
import { GoogleDriveService } from "@/services/google-drive.service";
import {
  accountSchema,
  materialSchema,
  memberSchema,
  projectSchema,
  transactionSchema,
  workerPaymentSchema,
  workerSchema,
} from "@/lib/google/schema";
import { ConstructionProject } from "@/types/project";
import { SiteWorker, WorkerPayment } from "@/types/worker";
import { Transaction } from "@/types/transaction";
import { MaterialItem } from "@/types/material";
import { Account } from "@/types/account";
import { ProjectMember, driveRoleForProjectRole } from "@/types/member";

/** Points at the exact spreadsheet + 1-based row a record lives in. */
interface RowRef {
  spreadsheetId: string;
  rowIndex: number;
}
type RowRefMap = Record<string, RowRef>;

/** Raw per-project-sheet reads, before workers & payments are stitched together. */
interface LoadedProjectSheet {
  sheetId: string;
  work: { items: Omit<SiteWorker, "payments">[]; rowIndexById: Record<string, number> };
  pays: { items: WorkerPayment[] };
  txns: { items: Transaction[] };
  mats: { items: MaterialItem[] };
}

/** Reads a single project spreadsheet's data tabs (workers/payments/txns/materials). */
async function loadProjectSheet(sheetId: string): Promise<LoadedProjectSheet> {
  const [work, pays, txns, mats] = await Promise.all([
    GoogleSheetsService.readAll(sheetId, workerSchema),
    GoogleSheetsService.readAll(sheetId, workerPaymentSchema),
    GoogleSheetsService.readAll(sheetId, transactionSchema),
    GoogleSheetsService.readAll(sheetId, materialSchema),
  ]);
  return { sheetId, work, pays, txns, mats };
}

/** Stitches workers to their payments and flattens transactions/materials across sheets. */
function assembleProjectData(loaded: LoadedProjectSheet[]) {
  const workers: SiteWorker[] = [];
  const transactions: Transaction[] = [];
  const materials: MaterialItem[] = [];
  const workerRows: RowRefMap = {};

  for (const { sheetId, work, pays, txns, mats } of loaded) {
    const paymentsByWorker = new Map<string, WorkerPayment[]>();
    for (const p of pays.items) {
      const list = paymentsByWorker.get(p.workerId) ?? [];
      list.push(p);
      paymentsByWorker.set(p.workerId, list);
    }

    for (const w of work.items) {
      const payments = (paymentsByWorker.get(w.id) ?? []).sort((a, b) =>
        b.date.localeCompare(a.date)
      );
      workers.push({
        ...w,
        payments,
        totalPaidOut: payments.reduce((acc, p) => acc + p.amount, 0),
        totalDaysWorked: payments.reduce((acc, p) => acc + p.daysWorked, 0),
      });
      workerRows[w.id] = { spreadsheetId: sheetId, rowIndex: work.rowIndexById[w.id] };
    }

    transactions.push(...txns.items);
    materials.push(...mats.items);
  }

  return { workers, transactions, materials, workerRows };
}

/**
 * Fills in a project's money figures from the ground truth rather than manual
 * entry: amount paid = income transactions, labor = worker payouts, cost =
 * expenses + labor, remaining = fee − paid. This lets the fee/costs stay empty
 * until they actually happen (they're "calculated at the end").
 */
function withDerivedFinancials(
  project: ConstructionProject,
  workers: SiteWorker[],
  transactions: Transaction[]
): ConstructionProject {
  const forProject = transactions.filter((t) => t.projectId === project.id);
  const paid = forProject
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);
  const expense = forProject
    .filter((t) => t.type !== "income")
    .reduce((acc, t) => acc + t.amount, 0);
  const labor = workers
    .filter((w) => w.projectId === project.id)
    .reduce((acc, w) => acc + (w.totalPaidOut ?? 0), 0);
  const totalExpense = expense + labor;
  const contractValue = project.contractValue || 0;

  return {
    ...project,
    amountReceived: paid,
    laborCost: labor,
    totalExpense,
    remainingBalance: contractValue > 0 ? Math.max(0, contractValue - paid) : 0,
    currentProfit: paid - totalExpense,
  };
}

interface DataContextType {
  loading: boolean;
  error: string | null;
  projects: ConstructionProject[];
  workers: SiteWorker[];
  transactions: Transaction[];
  materials: MaterialItem[];
  accounts: Account[];
  reload: () => Promise<void>;
  addProject: (project: ConstructionProject) => Promise<void>;
  updateProject: (project: ConstructionProject) => Promise<void>;
  addWorker: (worker: SiteWorker) => Promise<void>;
  updateWorker: (worker: SiteWorker) => Promise<void>;
  recordWorkerPayment: (worker: SiteWorker, payment: WorkerPayment) => Promise<SiteWorker>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  addMaterial: (material: MaterialItem) => Promise<void>;
  addAccount: (account: Account) => Promise<void>;
  /** Reads the Members registry from a project's own spreadsheet. */
  loadMembers: (projectId: string) => Promise<ProjectMember[]>;
  /** Shares a project's spreadsheet with a collaborator and records their role. */
  inviteMember: (projectId: string, member: ProjectMember) => Promise<void>;
  /** Revokes a collaborator's Drive access to a project's spreadsheet. */
  revokeMember: (projectId: string, email: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const {
    spreadsheetId,
    workspaceState,
    workspaceMode,
    workspaceTree,
    sharedSheetIds,
    user,
    setSyncStatus,
    markSynced,
  } = useGoogleAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ConstructionProject[]>([]);
  const [workers, setWorkers] = useState<SiteWorker[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Where each record lives, so mutations can target the exact sheet + row.
  const [projectRows, setProjectRows] = useState<RowRefMap>({});
  const [workerRows, setWorkerRows] = useState<RowRefMap>({});

  /** Finds a project's own spreadsheet id, throwing a friendly error if missing. */
  const projectSheetId = useCallback(
    (projectId: string): string => {
      const proj = projects.find((p) => p.id === projectId);
      if (!proj?.projectSpreadsheetId) {
        throw new Error("Please select a valid project (its spreadsheet is missing).");
      }
      return proj.projectSpreadsheetId;
    },
    [projects]
  );

  /** Contractor/owner load: master registry + every per-project spreadsheet. */
  const reloadOwner = useCallback(async () => {
    if (!spreadsheetId) return;
    // 1) Master registry: projects list + workspace-level accounts.
    const [projRes, accRes] = await Promise.all([
      GoogleSheetsService.readAll(spreadsheetId, projectSchema),
      GoogleSheetsService.readAll(spreadsheetId, accountSchema),
    ]);

    const nextProjectRows: RowRefMap = {};
    for (const [id, rowIndex] of Object.entries(projRes.rowIndexById)) {
      nextProjectRows[id] = { spreadsheetId, rowIndex };
    }

    // 2) Per-project spreadsheets: load & merge each project's data.
    const sources = projRes.items.filter((p) => p.projectSpreadsheetId);
    const loaded = await Promise.all(
      sources.map((p) => loadProjectSheet(p.projectSpreadsheetId as string))
    );
    const { workers, transactions, materials, workerRows } = assembleProjectData(loaded);
    const derivedProjects = projRes.items.map((p) =>
      withDerivedFinancials(p, workers, transactions)
    );

    setProjects(derivedProjects);
    setProjectRows(nextProjectRows);
    setAccounts(accRes.items);
    setWorkers(workers);
    setWorkerRows(workerRows);
    setTransactions(transactions);
    setMaterials(materials);
  }, [spreadsheetId]);

  /**
   * Invited-collaborator load: no master ledger, so each shared project sheet is
   * the source of truth. The project header is read from the sheet's own
   * "Projects" tab (falling back to its hidden Settings metadata on legacy sheets
   * that predate it), and the project's data tabs supply workers/txns/materials.
   */
  const reloadCollaborator = useCallback(async () => {
    const loadedSheets: LoadedProjectSheet[] = [];
    const collaboratorProjects: ConstructionProject[] = [];

    await Promise.all(
      sharedSheetIds.map(async (sheetId) => {
        const settings = await GoogleSheetsService.readKeyValues(sheetId).catch(
          () => ({}) as Record<string, string>
        );

        let header: ConstructionProject | null = null;
        try {
          const projRes = await GoogleSheetsService.readAll(sheetId, projectSchema);
          header = projRes.items[0] ?? null;
        } catch {
          // Legacy shared sheet without a Projects tab — fall back to Settings.
        }

        const projectId = header?.id || settings.projectId || sheetId;
        const project: ConstructionProject = header
          ? { ...header, id: projectId }
          : {
              id: projectId,
              code: "",
              name: settings.projectName || "Shared Project",
              ownerName: settings.ownerEmail || "",
              address: "",
              startDate: "",
              estimatedCompletion: "",
              status: "running",
              contractValue: 0,
              amountReceived: 0,
              remainingBalance: 0,
              totalExpense: 0,
              laborCost: 0,
              materialCost: 0,
              architectCost: 0,
              currentProfit: 0,
              manager: "",
            };
        project.projectSpreadsheetId = sheetId;
        collaboratorProjects.push(project);

        loadedSheets.push(await loadProjectSheet(sheetId));
      })
    );

    const { workers, transactions, materials, workerRows } = assembleProjectData(loadedSheets);
    const derivedProjects = collaboratorProjects.map((p) =>
      withDerivedFinancials(p, workers, transactions)
    );

    setProjects(derivedProjects);
    setProjectRows({});
    setAccounts([]);
    setWorkers(workers);
    setWorkerRows(workerRows);
    setTransactions(transactions);
    setMaterials(materials);
  }, [sharedSheetIds]);

  const reload = useCallback(async () => {
    if (workspaceMode === "collaborator" ? sharedSheetIds.length === 0 : !spreadsheetId) return;
    setLoading(true);
    setError(null);
    setSyncStatus("syncing");
    try {
      if (workspaceMode === "collaborator") {
        await reloadCollaborator();
      } else {
        await reloadOwner();
      }
      markSynced();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data from Google Sheets");
      setSyncStatus("error");
    } finally {
      setLoading(false);
    }
  }, [
    workspaceMode,
    spreadsheetId,
    sharedSheetIds,
    reloadOwner,
    reloadCollaborator,
    setSyncStatus,
    markSynced,
  ]);

  useEffect(() => {
    if (workspaceState !== "ready") return;
    if (workspaceMode === "collaborator" ? sharedSheetIds.length > 0 : !!spreadsheetId) {
      void reload();
    }
  }, [workspaceState, workspaceMode, spreadsheetId, sharedSheetIds, reload]);

  // ---- Mutations -------------------------------------------------------

  const addProject = useCallback(
    async (project: ConstructionProject) => {
      if (!spreadsheetId) throw new Error("No workspace connected");

      // Each project gets its own spreadsheet + Drive folder.
      const parentFolderId = workspaceTree?.projectsFolderId || workspaceTree?.rootFolderId || "";
      const prov = await GoogleDriveService.provisionProject(
        project.name,
        project.id,
        user?.email || "",
        workspaceTree?.workspaceId || "",
        parentFolderId
      );

      const full: ConstructionProject = {
        ...project,
        projectSpreadsheetId: prov.spreadsheetId,
        projectFolderId: prov.projectFolderId,
        folders: {
          projectFolderId: prov.projectFolderId,
          projectName: project.name,
          spreadsheetId: prov.spreadsheetId,
          spreadsheetUrl: prov.spreadsheetUrl,
          billsFolderId: "",
          photosFolderId: "",
          contractsFolderId: "",
          drawingsFolderId: "",
        },
      };

      const rowIndex = await GoogleSheetsService.appendRow(spreadsheetId, projectSchema, full);
      // Mirror the header into the project's own sheet so invited collaborators
      // (who can't see the master ledger) can read the project's details.
      await GoogleSheetsService.writeProjectHeader(prov.spreadsheetId, full);
      setProjects((prev) => [full, ...prev]);
      setProjectRows((prev) => ({ ...prev, [full.id]: { spreadsheetId, rowIndex } }));
      markSynced();
    },
    [spreadsheetId, workspaceTree, user, markSynced]
  );

  const updateProject = useCallback(
    async (project: ConstructionProject) => {
      if (!spreadsheetId) throw new Error("No workspace connected");
      const ref = projectRows[project.id];
      if (ref) {
        await GoogleSheetsService.updateRow(ref.spreadsheetId, projectSchema, ref.rowIndex, project);
      }
      // Keep the collaborator-facing copy in the project's own sheet in sync.
      if (project.projectSpreadsheetId) {
        await GoogleSheetsService.writeProjectHeader(project.projectSpreadsheetId, project);
      }
      setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)));
      markSynced();
    },
    [spreadsheetId, projectRows, markSynced]
  );

  const addWorker = useCallback(
    async (worker: SiteWorker) => {
      const sheetId = projectSheetId(worker.projectId);
      const rowIndex = await GoogleSheetsService.appendRow(sheetId, workerSchema, worker);
      setWorkers((prev) => [{ ...worker, payments: worker.payments ?? [] }, ...prev]);
      setWorkerRows((prev) => ({ ...prev, [worker.id]: { spreadsheetId: sheetId, rowIndex } }));
      markSynced();
    },
    [projectSheetId, markSynced]
  );

  const updateWorker = useCallback(
    async (worker: SiteWorker) => {
      const ref = workerRows[worker.id];
      if (ref) {
        await GoogleSheetsService.updateRow(ref.spreadsheetId, workerSchema, ref.rowIndex, worker);
      }
      setWorkers((prev) => prev.map((w) => (w.id === worker.id ? worker : w)));
      markSynced();
    },
    [workerRows, markSynced]
  );

  const recordWorkerPayment = useCallback(
    async (worker: SiteWorker, payment: WorkerPayment): Promise<SiteWorker> => {
      const ref = workerRows[worker.id];
      const sheetId = ref?.spreadsheetId ?? projectSheetId(worker.projectId);
      await GoogleSheetsService.appendRow(sheetId, workerPaymentSchema, payment);

      const payments = [payment, ...(worker.payments ?? [])];
      const updatedWorker: SiteWorker = {
        ...worker,
        payments,
        totalPaidOut: payments.reduce((acc, p) => acc + p.amount, 0),
        totalDaysWorked: payments.reduce((acc, p) => acc + p.daysWorked, 0),
      };

      if (ref) {
        await GoogleSheetsService.updateRow(ref.spreadsheetId, workerSchema, ref.rowIndex, updatedWorker);
      }
      setWorkers((prev) => prev.map((w) => (w.id === worker.id ? updatedWorker : w)));

      // A wage payout is a labor expense, so keep the project's derived figures
      // in sync immediately (labor cost, total expense and profit) without
      // waiting for a full reload.
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== worker.projectId) return p;
          const laborCost = p.laborCost + payment.amount;
          const totalExpense = p.totalExpense + payment.amount;
          return {
            ...p,
            laborCost,
            totalExpense,
            currentProfit: p.amountReceived - totalExpense,
          };
        })
      );
      markSynced();
      return updatedWorker;
    },
    [workerRows, projectSheetId, markSynced]
  );

  const addTransaction = useCallback(
    async (transaction: Transaction) => {
      const sheetId = projectSheetId(transaction.projectId);
      await GoogleSheetsService.appendRow(sheetId, transactionSchema, transaction);
      setTransactions((prev) => [transaction, ...prev]);
      // Keep the affected project's derived figures in sync immediately so the
      // UI reflects the new payment/expense without waiting for a full reload.
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== transaction.projectId) return p;
          const isIncome = transaction.type === "income";
          const paid = p.amountReceived + (isIncome ? transaction.amount : 0);
          const totalExpense = p.totalExpense + (isIncome ? 0 : transaction.amount);
          const contractValue = p.contractValue || 0;
          return {
            ...p,
            amountReceived: paid,
            totalExpense,
            remainingBalance: contractValue > 0 ? Math.max(0, contractValue - paid) : 0,
            currentProfit: paid - totalExpense,
          };
        })
      );
      markSynced();
    },
    [projectSheetId, markSynced]
  );

  const addMaterial = useCallback(
    async (material: MaterialItem) => {
      const sheetId = projectSheetId(material.projectId);
      await GoogleSheetsService.appendRow(sheetId, materialSchema, material);
      setMaterials((prev) => [material, ...prev]);
      markSynced();
    },
    [projectSheetId, markSynced]
  );

  const addAccount = useCallback(
    async (account: Account) => {
      if (!spreadsheetId) throw new Error("No workspace connected");
      await GoogleSheetsService.appendRow(spreadsheetId, accountSchema, account);
      setAccounts((prev) => [account, ...prev]);
      markSynced();
    },
    [spreadsheetId, markSynced]
  );

  // ---- Collaboration ---------------------------------------------------

  const loadMembers = useCallback(
    async (projectId: string): Promise<ProjectMember[]> => {
      const sheetId = projectSheetId(projectId);
      const res = await GoogleSheetsService.readAll(sheetId, memberSchema);
      return res.items;
    },
    [projectSheetId]
  );

  const inviteMember = useCallback(
    async (projectId: string, member: ProjectMember) => {
      const sheetId = projectSheetId(projectId);
      // 1) Grant Drive access (this sends Google's invitation email).
      await GoogleDriveService.shareFileWithUser(
        sheetId,
        member.email,
        driveRoleForProjectRole(member.role),
        true
      );
      // 2) Record the custom role in the project's Members registry.
      await GoogleSheetsService.appendRow(sheetId, memberSchema, member);
      markSynced();
    },
    [projectSheetId, markSynced]
  );

  const revokeMember = useCallback(
    async (projectId: string, email: string) => {
      const sheetId = projectSheetId(projectId);
      const permissions = await GoogleDriveService.listFilePermissions(sheetId);
      const match = permissions.find(
        (p) => p.emailAddress?.toLowerCase() === email.toLowerCase() && p.role !== "owner"
      );
      if (match) {
        await GoogleDriveService.revokePermission(sheetId, match.id);
      }
      markSynced();
    },
    [projectSheetId, markSynced]
  );

  return (
    <DataContext.Provider
      value={{
        loading,
        error,
        projects,
        workers,
        transactions,
        materials,
        accounts,
        reload,
        addProject,
        updateProject,
        addWorker,
        updateWorker,
        recordWorkerPayment,
        addTransaction,
        addMaterial,
        addAccount,
        loadMembers,
        inviteMember,
        revokeMember,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used within a DataProvider");
  }
  return ctx;
}

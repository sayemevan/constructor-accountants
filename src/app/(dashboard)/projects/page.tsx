"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { ProjectStatusPill } from "@/components/common/status-pill";
import { ProjectDialog } from "@/features/projects/project-dialog";
import { MembersDialog } from "@/features/projects/members-dialog";
import { FeeDialog } from "@/features/projects/fee-dialog";
import { ReceivePaymentDialog } from "@/features/transactions/receive-payment-dialog";
import { ConstructionProject } from "@/types/project";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useData } from "@/providers/data-provider";
import { useGoogleAuth } from "@/providers/google-auth-provider";
import { useSettings } from "@/providers/settings-provider";
import { formatDate } from "@/utils/formatters";
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Calendar,
  User,
  LayoutGrid,
  List,
  Folder,
  FileSpreadsheet,
  Receipt,
  Camera,
  FileText,
  Compass,
  TrendingUp,
  DollarSign,
  Briefcase,
  Layers,
  Hammer,
  DraftingCompass,
  Users,
  Edit,
  Eye,
  History,
  CheckCircle2,
  Calculator,
  HandCoins,
} from "lucide-react";

export default function ProjectsPage() {
  const { projects: projectsList, workers, transactions } = useData();
  const { workspaceMode } = useGoogleAuth();
  const isCollaborator = workspaceMode === "collaborator";
  const { formatCurrency } = useSettings();

  const workerCount = (projectId: string) =>
    workers.filter((w) => w.projectId === projectId).length;

  // The client's payments = income transactions recorded against the project.
  const paymentHistory = (projectId: string) =>
    transactions
      .filter((t) => t.projectId === projectId && t.type === "income")
      .sort((a, b) => b.date.localeCompare(a.date));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<ConstructionProject | null>(null);
  const [membersProject, setMembersProject] = useState<ConstructionProject | null>(null);
  const [feeProject, setFeeProject] = useState<ConstructionProject | null>(null);
  const [paymentProject, setPaymentProject] = useState<ConstructionProject | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredProjects = projectsList.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title={isCollaborator ? "Shared Projects" : "Construction Project Dashboard"}
        description={
          isCollaborator
            ? "Projects shared with you — project details, site team and costs"
            : "Monitor Contract Values, Amount Received, Remaining Balances, Quick Statistics, and direct Google Sheet sync"
        }
      >
        {!isCollaborator && (
          <Button
            onClick={() => {
              setProjectToEdit(null);
              setDialogOpen(true);
            }}
            className="text-xs shadow-md shadow-amber-500/20"
          >
            <Plus className="h-4 w-4 mr-1" />
            <span>New Project</span>
          </Button>
        )}
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215]">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400" />
            <Input
              placeholder="Search project, owner, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
          >
            <option value="all">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>

        <div className="flex items-center space-x-1 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md text-xs ${viewMode === "grid" ? "bg-zinc-100 dark:bg-zinc-800 text-amber-500 font-semibold" : "text-zinc-400"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md text-xs ${viewMode === "list" ? "bg-zinc-100 dark:bg-zinc-800 text-amber-500 font-semibold" : "text-zinc-400"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredProjects.map((project) => {
            const receivedPercent = Math.min(100, Math.round((project.amountReceived / project.contractValue) * 100));
            return (
              <Card key={project.id} className="hover:border-amber-500/40 transition-all flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-medium text-amber-600 dark:text-amber-400">
                        {project.code}
                      </span>
                      <CardTitle className="text-base mt-0.5 flex items-center">
                        <Building2 className="h-4 w-4 mr-1.5 text-amber-500 shrink-0" />
                        <span>{project.name}</span>
                      </CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <MapPin className="h-3 w-3 mr-1 text-zinc-400 shrink-0" />
                        <span className="truncate">{project.address}</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ProjectStatusPill status={project.status} />
                      {!isCollaborator && (
                        <button
                          onClick={() => {
                            setProjectToEdit(project);
                            setDialogOpen(true);
                          }}
                          title="Edit project"
                          className="text-zinc-400 hover:text-amber-500 transition-colors"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {isCollaborator ? (
                    /* Client view: cost, worker count, remaining */
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80">
                        <span className="text-[10px] text-zinc-400 block">Project Cost</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                          {formatCurrency(project.totalExpense)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80">
                        <span className="text-[10px] text-zinc-400 block">Site Workers</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                          {workerCount(project.id)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-semibold">Remaining</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                          {formatCurrency(project.remainingBalance)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Contract Financial Summary */}
                      <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500 font-medium">Contract Value</span>
                          <span className="font-bold text-zinc-900 dark:text-zinc-50 text-sm">
                            {formatCurrency(project.contractValue)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-semibold">Amount Received</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                              {formatCurrency(project.amountReceived)}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-semibold">Remaining Balance</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                              {formatCurrency(project.remainingBalance)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-zinc-500">
                            <span>Payment Collected</span>
                            <span>{receivedPercent}%</span>
                          </div>
                          <Progress value={receivedPercent} indicatorColor="bg-emerald-500" />
                        </div>
                      </div>

                      {/* Quick Statistics Grid */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Quick Statistics</span>
                          <Badge
                            variant={project.currentProfit >= 0 ? "success" : "destructive"}
                            className="text-[10px]"
                          >
                            Profit: {formatCurrency(project.currentProfit)}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/80">
                            <span className="text-[10px] text-zinc-400 block">Total Expense</span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                              {formatCurrency(project.totalExpense)}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/80">
                            <span className="text-[10px] text-zinc-400 block flex items-center justify-center">
                              <Hammer className="h-2.5 w-2.5 mr-0.5 text-amber-500" /> Labor
                            </span>
                            <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                              {formatCurrency(project.laborCost)}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/80">
                            <span className="text-[10px] text-zinc-400 block flex items-center justify-center">
                              <Layers className="h-2.5 w-2.5 mr-0.5 text-blue-500" /> Material
                            </span>
                            <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                              {formatCurrency(project.materialCost)}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/80">
                            <span className="text-[10px] text-zinc-400 block flex items-center justify-center">
                              <DraftingCompass className="h-2.5 w-2.5 mr-0.5 text-purple-500" /> Architect
                            </span>
                            <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                              {formatCurrency(project.architectCost)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Payment receiving history — shown for owner and client */}
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-emerald-500/20">
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center">
                        <History className="h-3.5 w-3.5 mr-1.5" />
                        Payment History
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          Paid: {formatCurrency(project.amountReceived)}
                        </span>
                        {!isCollaborator && (
                          <button
                            type="button"
                            onClick={() => setPaymentProject(project)}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 transition-colors"
                          >
                            <HandCoins className="h-3.5 w-3.5" />
                            Receive
                          </button>
                        )}
                      </div>
                    </div>

                    {paymentHistory(project.id).length === 0 ? (
                      <p className="px-3 py-3 text-[11px] text-zinc-400 text-center">
                        No payments recorded yet.
                      </p>
                    ) : (
                      <ul className="divide-y divide-emerald-500/10 max-h-40 overflow-y-auto">
                        {paymentHistory(project.id).map((pay) => (
                          <li
                            key={pay.id}
                            className="flex items-center justify-between px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <div className="flex flex-col min-w-0">
                                <span className="text-zinc-700 dark:text-zinc-200">
                                  {formatDate(pay.date)}
                                </span>
                                {(pay.description || pay.payeeOrPayer) && (
                                  <span className="text-[10px] text-zinc-400 truncate">
                                    {pay.description || pay.payeeOrPayer}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                              {formatCurrency(pay.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Dates & Manager */}
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-500 pt-1">
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="truncate">Owner: <strong className="text-zinc-800 dark:text-zinc-200">{project.ownerName}</strong></span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3 text-amber-500 shrink-0" />
                      <span>Start: {formatDate(project.startDate)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span>End: {formatDate(project.estimatedCompletion)}</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3 text-xs justify-between gap-2 flex-wrap">
                  {isCollaborator ? (
                    <span className="flex items-center text-xs text-zinc-400">
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Read-only shared access
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => setFeeProject(project)}
                        className="flex items-center text-xs text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        <Calculator className="h-3.5 w-3.5 mr-1 text-amber-500" />
                        Construction Fee
                      </button>
                      <button
                        onClick={() => setMembersProject(project)}
                        className="flex items-center text-xs text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        <Users className="h-3.5 w-3.5 mr-1 text-amber-500" />
                        Team & Access
                      </button>
                      <a href={project.folders?.spreadsheetUrl || "#"} target="_blank" rel="noreferrer" className="flex items-center text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                        Sheet
                      </a>
                    </>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List View */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">Project Title</th>
                    <th className="p-3">{isCollaborator ? "Manager" : "Owner"}</th>
                    <th className="p-3">Status</th>
                    {!isCollaborator && <th className="p-3">Contract Value</th>}
                    <th className="p-3">{isCollaborator ? "Cost" : "Total Expense"}</th>
                    <th className="p-3">{isCollaborator ? "Amount Paid" : "Received"}</th>
                    <th className="p-3">{isCollaborator ? "Remaining Amount" : "Remaining"}</th>
                    {isCollaborator && <th className="p-3">Workers</th>}
                    {!isCollaborator && <th className="p-3">Profit</th>}
                    {!isCollaborator && <th className="p-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {filteredProjects.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                      <td className="p-3 font-mono font-medium text-amber-600 dark:text-amber-400">{p.code}</td>
                      <td className="p-3 font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</td>
                      <td className="p-3 text-zinc-500">{isCollaborator ? p.manager || p.ownerName || "—" : p.ownerName}</td>
                      <td className="p-3"><ProjectStatusPill status={p.status} /></td>
                      {!isCollaborator && <td className="p-3 font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(p.contractValue)}</td>}
                      <td className="p-3 text-zinc-500">{formatCurrency(p.totalExpense)}</td>
                      <td className="p-3 text-emerald-500 font-semibold">{formatCurrency(p.amountReceived)}</td>
                      <td className="p-3 text-amber-500 font-semibold">{formatCurrency(p.remainingBalance)}</td>
                      {isCollaborator && <td className="p-3 font-semibold text-zinc-900 dark:text-zinc-100">{workerCount(p.id)}</td>}
                      {!isCollaborator && (
                        <td className={`p-3 font-bold ${p.currentProfit >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {formatCurrency(p.currentProfit)}
                        </td>
                      )}
                      {!isCollaborator && (
                        <td className="p-3 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPaymentProject(p)}
                            className="h-7 text-xs text-emerald-500"
                          >
                            <HandCoins className="h-3.5 w-3.5 mr-1" />
                            Receive
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setProjectToEdit(p);
                              setDialogOpen(true);
                            }}
                            className="h-7 text-xs text-amber-500"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ProjectDialog
        open={dialogOpen}
        projectToEdit={projectToEdit}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setProjectToEdit(null);
        }}
      />
      <MembersDialog
        project={membersProject}
        open={!!membersProject}
        onOpenChange={(o) => {
          if (!o) setMembersProject(null);
        }}
      />
      <FeeDialog
        project={feeProject}
        open={!!feeProject}
        onOpenChange={(o) => {
          if (!o) setFeeProject(null);
        }}
      />
      <ReceivePaymentDialog
        project={paymentProject}
        open={!!paymentProject}
        onOpenChange={(o) => {
          if (!o) setPaymentProject(null);
        }}
      />
    </div>
  );
}

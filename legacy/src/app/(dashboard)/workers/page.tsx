"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { WorkerDialog } from "@/features/workers/worker-dialog";
import { WorkerDetailsDialog } from "@/features/workers/worker-details-dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import { formatDate } from "@/utils/formatters";
import { SiteWorker } from "@/types/worker";
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  Calendar,
  Building2,
  HardHat,
  LayoutGrid,
  List,
  UserX,
  Edit,
  Eye,
  DollarSign,
  Briefcase,
  History,
} from "lucide-react";

export default function WorkersPage() {
  const { workers: workersList, updateWorker } = useData();
  const { formatCurrency } = useSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<SiteWorker | null>(null);
  const [workerToEdit, setWorkerToEdit] = useState<SiteWorker | null>(null);

  const filteredWorkers = workersList.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrade = tradeFilter === "all" || w.trade === tradeFilter;
    const matchesStatus = statusFilter === "all" || w.status === statusFilter;
    return matchesSearch && matchesTrade && matchesStatus;
  });

  const activeWorkersCount = workersList.filter((w) => w.status === "active").length;
  const totalDailyPayroll = workersList
    .filter((w) => w.status === "active")
    .reduce((acc, w) => acc + w.dailyWage, 0);
  const totalPaidOutSum = workersList.reduce((acc, w) => acc + (w.totalPaidOut || 0), 0);

  const handleDeactivate = async (worker: SiteWorker) => {
    await updateWorker({ ...worker, status: "deactivated" });
  };

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Site Workers & Wage Ledger"
        description="Manage tradespeople, daily wages, project assignments, and payment histories stored inside Google Sheets"
      >
        <Button
          onClick={() => {
            setWorkerToEdit(null);
            setDialogOpen(true);
          }}
          className="text-xs shadow-md shadow-amber-500/20"
        >
          <Plus className="h-4 w-4 mr-1" />
          <span>Add New Worker</span>
        </Button>
      </PageHeader>

      {/* Quick Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Site Workers"
          value={`${workersList.length} Workers`}
          subtitle="Across all active projects"
          icon={Users}
          iconBgColor="bg-amber-500/10"
          iconTextColor="text-amber-500"
        />

        <StatCard
          title="Active Workforce"
          value={`${activeWorkersCount} Active`}
          subtitle={`${workersList.length - activeWorkersCount} inactive / deactivated`}
          icon={HardHat}
          iconBgColor="bg-emerald-500/10"
          iconTextColor="text-emerald-500"
        />

        <StatCard
          title="Daily Wage Payroll"
          value={formatCurrency(totalDailyPayroll)}
          subtitle="Daily active payroll commitment"
          icon={DollarSign}
          iconBgColor="bg-blue-500/10"
          iconTextColor="text-blue-500"
        />

        <StatCard
          title="Total Wages Paid Out"
          value={formatCurrency(totalPaidOutSum)}
          subtitle="Recorded in Google Sheets"
          icon={Briefcase}
          iconBgColor="bg-purple-500/10"
          iconTextColor="text-purple-500"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215]">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400" />
            <Input
              placeholder="Search worker by name, phone, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <select
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
            className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
          >
            <option value="all">All Trades</option>
            <option value="Mason">Mason</option>
            <option value="Carpenter">Carpenter</option>
            <option value="Electrician">Electrician</option>
            <option value="Plumber">Plumber</option>
            <option value="Steel Fixer">Steel Fixer</option>
            <option value="Painter">Painter</option>
            <option value="Welder">Welder</option>
            <option value="General Laborer">General Laborer</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deactivated">Deactivated</option>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkers.map((worker) => (
            <Card key={worker.id} className="hover:border-amber-500/40 transition-all flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 border-amber-500/30">
                    {worker.trade}
                  </Badge>
                  <Badge
                    variant={
                      worker.status === "active"
                        ? "success"
                        : worker.status === "deactivated"
                        ? "destructive"
                        : "secondary"
                    }
                    className="text-[10px] capitalize"
                  >
                    {worker.status}
                  </Badge>
                </div>

                <CardTitle className="text-base mt-2 flex items-center">
                  <HardHat className="h-4 w-4 mr-1.5 text-amber-500 shrink-0" />
                  <span>{worker.name}</span>
                </CardTitle>
                <CardDescription className="flex items-center text-xs mt-1">
                  <Building2 className="h-3 w-3 mr-1 text-zinc-400 shrink-0" />
                  <span className="truncate">{worker.projectName}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Daily Wage:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(worker.dailyWage)}/day
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Total Paid Out:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatCurrency(worker.totalPaidOut || 0)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-zinc-500">
                  <div className="flex items-center space-x-1.5">
                    <Phone className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>{worker.phone}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 truncate">
                    <MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">{worker.address}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>Joined: {formatDate(worker.joiningDate)}</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3 text-xs justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedWorker(worker);
                    setDetailsDialogOpen(true);
                  }}
                  className="text-xs h-7 flex-1"
                >
                  <Eye className="h-3 w-3 mr-1 text-amber-500" />
                  <span>Payment History</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setWorkerToEdit(worker);
                    setDialogOpen(true);
                  }}
                  className="text-xs h-7 px-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>

                {worker.status !== "deactivated" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeactivate(worker)}
                    className="text-xs h-7 px-2 text-red-500 hover:text-red-600"
                    title="Deactivate Worker"
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        /* List View */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-3">Worker Name</th>
                    <th className="p-3">Trade</th>
                    <th className="p-3">Project Assignment</th>
                    <th className="p-3">Daily Wage</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {filteredWorkers.map((w) => (
                    <tr key={w.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                      <td className="p-3 font-semibold text-zinc-900 dark:text-zinc-100">{w.name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          {w.trade}
                        </Badge>
                      </td>
                      <td className="p-3 text-zinc-500">{w.projectName}</td>
                      <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(w.dailyWage)}/day</td>
                      <td className="p-3 text-zinc-500">{w.phone}</td>
                      <td className="p-3">
                        <Badge
                          variant={w.status === "active" ? "success" : w.status === "deactivated" ? "destructive" : "secondary"}
                          className="capitalize text-[10px]"
                        >
                          {w.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedWorker(w);
                            setDetailsDialogOpen(true);
                          }}
                          className="h-7 text-xs text-amber-500"
                        >
                          View History
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Worker Modals */}
      <WorkerDialog open={dialogOpen} onOpenChange={setDialogOpen} workerToEdit={workerToEdit} />

      <WorkerDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        worker={selectedWorker}
        onWorkerUpdated={(updatedWorker) => setSelectedWorker(updatedWorker)}
      />
    </div>
  );
}

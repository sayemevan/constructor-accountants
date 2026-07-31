"use client";

import React from "react";
import { PageHeader } from "@/components/common/page-header";
import { useGoogleAuth } from "@/providers/google-auth-provider";
import { useData } from "@/providers/data-provider";
import { useSettings } from "@/providers/settings-provider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  HardDrive,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  LogOut,
  CheckCircle2,
  FolderTree,
  EyeOff,
  Folder,
  FileText,
  Coins,
} from "lucide-react";

export default function SettingsPage() {
  const { user, isAuthenticated, login, logout, syncStatus, workspaceTree } = useGoogleAuth();
  const { reload } = useData();
  const { currency, setCurrency, currencies, formatCurrency } = useSettings();

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in-50">
      <PageHeader
        title="Google Workspace & Storage Architecture"
        description="Every contractor owns their complete Google Drive folder tree and hidden Settings sheets — zero centralized database"
      />

      {/* Preferences: Display Currency */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-base">Display Currency</CardTitle>
              <CardDescription>
                Choose how monetary amounts are shown across the whole app. Defaults to Bangladeshi Taka (BDT).
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <label
                htmlFor="currency-select"
                className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block mb-1.5"
              >
                Currency
              </label>
              <select
                id="currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full sm:w-72 h-9 rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-sm focus:ring-1 focus:ring-amber-500 text-zinc-900 dark:text-zinc-100"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} — {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-400 mt-1.5">
                Applies instantly and is saved on this device. Amounts are stored as plain numbers, so no data is converted.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-center min-w-[9rem]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Preview</span>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {formatCurrency(1234567.89)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base">Contractor Google OAuth Account</CardTitle>
                <CardDescription>Zero backend DB — Data resides 100% inside contractor Google Drive</CardDescription>
              </div>
            </div>
            <Badge variant={isAuthenticated ? "success" : "secondary"} className="text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {isAuthenticated ? "Connected" : "Not Connected"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {user ? (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img src={user.picture} alt={user.name} className="h-10 w-10 rounded-full" />
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{user.name}</h4>
                  <p className="text-xs text-zinc-500">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void reload()}
                  disabled={syncStatus === "syncing"}
                  className="text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncStatus === "syncing" ? "animate-spin text-amber-500" : ""}`} />
                  Sync Workspace
                </Button>
                <Button variant="ghost" size="sm" onClick={logout} className="text-xs text-red-500">
                  <LogOut className="h-3.5 w-3.5 mr-1" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs text-zinc-500 mb-3">No Google Account connected.</p>
              <Button onClick={() => void login()}>Connect Contractor Google Account</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Workspace Folder Tree Hierarchy */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
              <FolderTree className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-base">Google Drive Workspace Hierarchy</CardTitle>
              <CardDescription>Root directory automatically initialized upon contractor login</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-zinc-100 font-mono text-xs space-y-2">
            <div className="flex items-center space-x-2 text-amber-400 font-bold">
              <Folder className="h-4 w-4" />
              <span>Construction Keeper/</span>
              <span className="text-[10px] text-zinc-500 font-normal">(Root Workspace ID: {workspaceTree?.workspaceId || "ws_ck_2026"})</span>
            </div>

            <div className="pl-6 space-y-2 text-zinc-300">
              <div className="flex items-center space-x-2">
                <Folder className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-semibold">Projects/</span>
              </div>
              <div className="pl-6 space-y-1.5 text-zinc-400">
                <div className="flex items-center space-x-2 text-amber-300">
                  <Folder className="h-3 w-3" />
                  <span>House A/</span>
                </div>
                <div className="pl-6 space-y-1 text-[11px] text-zinc-400">
                  <div>├── Data Spreadsheet (Google Sheet)</div>
                  <div>├── Bills Folder/</div>
                  <div>├── Photos Folder/</div>
                  <div>├── Contracts Folder/</div>
                  <div>└── Drawings Folder/</div>
                </div>

                <div className="flex items-center space-x-2 text-amber-300">
                  <Folder className="h-3 w-3" />
                  <span>Apartment Building/</span>
                </div>
                <div className="flex items-center space-x-2 text-amber-300">
                  <Folder className="h-3 w-3" />
                  <span>Office/</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Folder className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-semibold">Documents/</span>
              </div>
              <div className="flex items-center space-x-2">
                <Folder className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-semibold">Reports/</span>
              </div>
              <div className="flex items-center space-x-2">
                <Folder className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-semibold">Settings/</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hidden Settings Sheet Schema Specifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <EyeOff className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-base">Hidden &quot;Settings&quot; Sheet Metadata Schema</CardTitle>
              <CardDescription>Every project Data Spreadsheet contains a hidden Settings tab holding system key-values</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="p-3">Key Name</th>
                  <th className="p-3">Data Type</th>
                  <th className="p-3">Sample Value</th>
                  <th className="p-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                <tr>
                  <td className="p-3 font-semibold text-amber-500">Workspace ID</td>
                  <td className="p-3 text-zinc-500">String</td>
                  <td className="p-3 text-zinc-900 dark:text-zinc-100">ws_ck_2026_9a4b2</td>
                  <td className="p-3 text-zinc-400 font-sans">Unique contractor workspace identifier</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-amber-500">Project ID</td>
                  <td className="p-3 text-zinc-500">String</td>
                  <td className="p-3 text-zinc-900 dark:text-zinc-100">prj_01</td>
                  <td className="p-3 text-zinc-400 font-sans">Unique project identifier code</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-amber-500">Project Name</td>
                  <td className="p-3 text-zinc-500">String</td>
                  <td className="p-3 text-zinc-900 dark:text-zinc-100">Skyline Commercial Plaza</td>
                  <td className="p-3 text-zinc-400 font-sans">Title of project workspace</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-amber-500">Owner Email</td>
                  <td className="p-3 text-zinc-500">String</td>
                  <td className="p-3 text-zinc-900 dark:text-zinc-100">{user?.email || "alex@sterlingbuilders.com"}</td>
                  <td className="p-3 text-zinc-400 font-sans">Authenticated contractor Google email</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-amber-500">Version</td>
                  <td className="p-3 text-zinc-500">SemVer</td>
                  <td className="p-3 text-zinc-900 dark:text-zinc-100">1.0.0</td>
                  <td className="p-3 text-zinc-400 font-sans">Spreadsheet schema version format</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-amber-500">Created Date</td>
                  <td className="p-3 text-zinc-500">ISO-8601</td>
                  <td className="p-3 text-zinc-900 dark:text-zinc-100">2026-01-15T00:00:00Z</td>
                  <td className="p-3 text-zinc-400 font-sans">Spreadsheet creation timestamp</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

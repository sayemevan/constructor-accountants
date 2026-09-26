"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useGoogleAuth } from "@/providers/google-auth-provider";
import { useData } from "@/providers/data-provider";
import { CreateWorkspacePrompt } from "@/features/auth/create-workspace-prompt";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, HardDrive, Loader2, ShieldCheck } from "lucide-react";

function CenteredGate({ children }: { children: React.ReactNode }) {
  return <div className="max-w-xl mx-auto py-12 animate-in fade-in-50">{children}</div>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const {
    isConfigured,
    isPickerConfigured,
    isAuthenticated,
    isConnecting,
    authError,
    workspaceState,
    login,
    provisionWorkspace,
    detectWorkspace,
    openSharedProject,
  } = useGoogleAuth();
  const { loading, error } = useData();

  const renderBody = () => {
    if (!isConfigured) {
      return (
        <CenteredGate>
          <Card className="border-amber-500/30">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 rounded-2xl bg-amber-500/10 text-amber-500 w-fit mb-2">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <CardTitle>Google integration not configured</CardTitle>
              <CardDescription className="text-xs">
                Set <code className="font-mono text-amber-500">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in a{" "}
                <code className="font-mono">.env.local</code> file, then restart the dev server.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-zinc-500 space-y-2">
              <p>See the README section &quot;Connecting Google&quot; for the full Google Cloud Console setup steps.</p>
            </CardContent>
          </Card>
        </CenteredGate>
      );
    }

    if (!isAuthenticated) {
      return (
        <CenteredGate>
          <Card className="border-amber-500/30 shadow-xl shadow-amber-500/5">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 w-fit mb-2">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <CardTitle>Connect your Google account</CardTitle>
              <CardDescription className="text-xs">
                Your construction ledger is stored entirely inside your own Google Drive & Sheets. No backend database.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <Button onClick={() => void login()} disabled={isConnecting} className="text-xs shadow-md shadow-amber-500/20">
                {isConnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HardDrive className="h-4 w-4 mr-2" />}
                {isConnecting ? "Connecting..." : "Connect Contractor Google Account"}
              </Button>
              {authError && <p className="text-[11px] text-red-500 text-center max-w-sm">{authError}</p>}
            </CardContent>
          </Card>
        </CenteredGate>
      );
    }

    if (workspaceState === "loading" || (workspaceState === "ready" && loading)) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500 mb-3" />
          <p className="text-xs">Loading your Google Sheet ledger...</p>
        </div>
      );
    }

    if (workspaceState === "provisioning") {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500 mb-3" />
          <p className="text-xs">Creating your Construction Keeper workspace in Google Drive...</p>
        </div>
      );
    }

    if (workspaceState === "no_workspace") {
      return (
        <CreateWorkspacePrompt
          onWorkspaceCreated={provisionWorkspace}
          onOpenSharedProject={openSharedProject}
          pickerConfigured={isPickerConfigured}
        />
      );
    }

    if (workspaceState === "error" || error) {
      return (
        <CenteredGate>
          <Card className="border-red-500/30">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 rounded-2xl bg-red-500/10 text-red-500 w-fit mb-2">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription className="text-xs">{authError || error}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button variant="outline" onClick={() => void detectWorkspace()} className="text-xs">
                Retry
              </Button>
            </CardContent>
          </Card>
        </CenteredGate>
      );
    }

    return children;
  };

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-[#0c0c0e] text-zinc-900 dark:text-zinc-100 font-sans antialiased">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderBody()}
        </main>
      </div>
    </div>
  );
}

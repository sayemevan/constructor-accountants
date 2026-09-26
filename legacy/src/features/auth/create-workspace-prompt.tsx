"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HardDrive, FolderPlus, ShieldCheck, CheckCircle2, Loader2, Users, FileSpreadsheet } from "lucide-react";

interface CreateWorkspacePromptProps {
  onWorkspaceCreated: () => Promise<void>;
  /** Collaborator path: open a project spreadsheet shared by a contractor. */
  onOpenSharedProject?: () => Promise<void>;
  /** Whether the Google Picker is configured (needed for the collaborator path). */
  pickerConfigured?: boolean;
}

export function CreateWorkspacePrompt({
  onWorkspaceCreated,
  onOpenSharedProject,
  pickerConfigured,
}: CreateWorkspacePromptProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    await onWorkspaceCreated();
    setIsCreating(false);
  };

  const handleOpenShared = async () => {
    if (!onOpenSharedProject) return;
    setIsOpening(true);
    try {
      await onOpenSharedProject();
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 animate-in fade-in-50">
      <Card className="border-amber-500/30 shadow-xl shadow-amber-500/5">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto p-3 rounded-2xl bg-amber-500/10 text-amber-500 w-fit mb-3">
            <HardDrive className="h-8 w-8" />
          </div>
          <CardTitle className="text-xl">Initialize Contractor Workspace</CardTitle>
          <CardDescription className="text-xs">
            No existing &quot;Construction Keeper&quot; workspace folder was detected in your Google Drive.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs space-y-3">
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center">
              <FolderPlus className="h-4 w-4 mr-1.5 text-amber-500" />
              <span>Automatic Setup includes:</span>
            </h4>
            
            <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
              <li className="flex items-center">
                <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-500 shrink-0" />
                <span>Root directory: <strong>Construction Keeper/</strong></span>
              </li>
              <li className="flex items-center">
                <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-500 shrink-0" />
                <span>Subdirectories: <strong>Projects/</strong>, <strong>Documents/</strong>, <strong>Reports/</strong>, <strong>Settings/</strong></span>
              </li>
              <li className="flex items-center">
                <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-500 shrink-0" />
                <span>Default project Google Spreadsheet with hidden <strong>Settings</strong> metadata tab</span>
              </li>
            </ul>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-zinc-500 justify-center">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>100% Contractor Data Ownership • Zero Centralized Database</span>
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-4">
          <Button
            onClick={handleCreate}
            disabled={isCreating || isOpening}
            className="w-full text-xs shadow-lg shadow-amber-500/20 py-5"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span>Creating Google Drive Folders & Sheets...</span>
              </>
            ) : (
              <>
                <FolderPlus className="h-4 w-4 mr-2" />
                <span>Create Workspace Now</span>
              </>
            )}
          </Button>

          {onOpenSharedProject && (
            <div className="w-full space-y-3 border-t border-zinc-100 dark:border-zinc-800/80 pt-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <Users className="h-4 w-4 text-emerald-500" />
                <span>Invited to a project as a client or collaborator?</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                You don&apos;t need your own workspace. Open the project spreadsheet that was
                shared with you (check the Google invitation email) to see its data.
              </p>
              <Button
                variant="outline"
                onClick={handleOpenShared}
                disabled={isOpening || isCreating || pickerConfigured === false}
                className="w-full text-xs py-5"
              >
                {isOpening ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span>Opening shared project...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-500" />
                    <span>Open a Project Shared With Me</span>
                  </>
                )}
              </Button>
              {pickerConfigured === false && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                  The Google Picker isn&apos;t configured. Set
                  <code className="font-mono mx-1">NEXT_PUBLIC_GOOGLE_API_KEY</code>
                  in <code className="font-mono">.env.local</code> to enable opening shared projects.
                </p>
              )}
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

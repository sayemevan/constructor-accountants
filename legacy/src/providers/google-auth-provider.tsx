"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  GoogleUserProfile,
  SyncStatus,
  GoogleWorkspaceTree,
  WorkspaceState,
} from "@/types/google";
import { GoogleAuthService } from "@/services/google-auth.service";
import { GoogleDriveService } from "@/services/google-drive.service";
import { isGoogleConfigured, isPickerConfigured } from "@/lib/google-config";
import { pickProjectSpreadsheet } from "@/lib/google/picker-client";

/**
 * "owner"        — a contractor who owns a Construction Keeper master workspace.
 * "collaborator" — an invited client/collaborator who has no master workspace of
 *                  their own and instead opens one or more project spreadsheets
 *                  that a contractor shared with them.
 */
export type WorkspaceMode = "owner" | "collaborator";

interface GoogleAuthContextType {
  user: GoogleUserProfile | null;
  isConfigured: boolean;
  isPickerConfigured: boolean;
  isAuthenticated: boolean;
  isConnecting: boolean;
  authError: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  workspaceState: WorkspaceState;
  workspaceMode: WorkspaceMode;
  workspaceTree: GoogleWorkspaceTree | null;
  spreadsheetId: string | null;
  /** Project spreadsheet ids a collaborator has opened via the Google Picker. */
  sharedSheetIds: string[];
  login: () => Promise<void>;
  logout: () => void;
  provisionWorkspace: () => Promise<void>;
  detectWorkspace: () => Promise<void>;
  /** Opens the Google Picker so an invited collaborator can attach a shared project. */
  openSharedProject: () => Promise<void>;
  /** Forgets a previously opened shared project (collaborator only). */
  removeSharedProject: (sheetId: string) => void;
  setSyncStatus: (status: SyncStatus) => void;
  markSynced: () => void;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

/** localStorage key for the shared project sheets a given account has opened. */
const sharedSheetsKey = (email: string) => `cca_shared_project_sheets:${email.toLowerCase()}`;

function loadSharedSheets(email: string | undefined | null): string[] {
  if (!email || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(sharedSheetsKey(email));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function saveSharedSheets(email: string | undefined | null, ids: string[]): void {
  if (!email || typeof window === "undefined") return;
  localStorage.setItem(sharedSheetsKey(email), JSON.stringify(Array.from(new Set(ids))));
}

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const [isConfigured] = useState(isGoogleConfigured());
  const [user, setUser] = useState<GoogleUserProfile | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(
    isGoogleConfigured() ? "loading" : "no_workspace"
  );
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("owner");
  const [workspaceTree, setWorkspaceTree] = useState<GoogleWorkspaceTree | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [sharedSheetIds, setSharedSheetIds] = useState<string[]>([]);

  const markSynced = useCallback(() => {
    setSyncStatus("success");
    setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, []);

  /**
   * Figures out how this account should enter the app:
   *  1. If they own an app-created master ledger → contractor "owner" mode.
   *  2. Else, if they've previously opened project sheets shared with them →
   *     restore "collaborator" mode with those sheets.
   *  3. Otherwise there's nothing to show yet → the workspace gate.
   */
  const detectWorkspace = useCallback(async () => {
    setWorkspaceState("loading");
    setAuthError(null);
    try {
      const sheet = await GoogleDriveService.findMasterSpreadsheet();
      if (sheet) {
        setWorkspaceMode("owner");
        setSharedSheetIds([]);
        setSpreadsheetId(sheet.id);
        const rootFolderId = await GoogleDriveService.findWorkspaceFolder();
        const projectsFolderId = rootFolderId
          ? (await GoogleDriveService.findChildFolder(rootFolderId, "Projects")) ?? ""
          : "";
        setWorkspaceTree(
          rootFolderId
            ? ({
                rootFolderId,
                rootFolderName: "Construction Keeper",
                projectsFolderId,
                documentsFolderId: "",
                reportsFolderId: "",
                settingsFolderId: "",
                workspaceId: sheet.id,
                createdAt: "",
              } as GoogleWorkspaceTree)
            : null
        );
        setWorkspaceState("ready");
        return;
      }

      // No master ledger of their own — maybe they're an invited collaborator.
      setSpreadsheetId(null);
      setWorkspaceTree(null);
      const email = GoogleAuthService.getStoredProfile()?.email;
      const restored = loadSharedSheets(email);
      if (restored.length > 0) {
        setWorkspaceMode("collaborator");
        setSharedSheetIds(restored);
        setWorkspaceState("ready");
      } else {
        setWorkspaceMode("owner");
        setSharedSheetIds([]);
        setWorkspaceState("no_workspace");
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to inspect Google Drive");
      setWorkspaceState("error");
    }
  }, []);

  // On mount, restore an existing valid session (if any) and detect the workspace.
  useEffect(() => {
    if (!isConfigured) return;
    const profile = GoogleAuthService.getStoredProfile();
    if (profile && GoogleAuthService.isTokenValid()) {
      setUser(profile);
      void detectWorkspace();
    } else {
      // No restored session: fall back to the connect gate.
      setWorkspaceState("no_workspace");
    }
  }, [isConfigured, detectWorkspace]);

  const login = useCallback(async () => {
    setIsConnecting(true);
    setAuthError(null);
    try {
      const profile = await GoogleAuthService.signIn();
      setUser(profile);
      await detectWorkspace();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setIsConnecting(false);
    }
  }, [detectWorkspace]);

  const provisionWorkspace = useCallback(async () => {
    if (!user) return;
    setWorkspaceState("provisioning");
    setSyncStatus("syncing");
    setAuthError(null);
    try {
      const result = await GoogleDriveService.provisionWorkspace(user.email);
      setWorkspaceTree(result.workspaceTree);
      setSpreadsheetId(result.spreadsheetId);
      setWorkspaceState("ready");
      markSynced();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to create workspace");
      setWorkspaceState("error");
      setSyncStatus("error");
    }
  }, [user, markSynced]);

  /**
   * Collaborator entry point: opens the Google Picker so the user can select a
   * project spreadsheet a contractor shared with them. Picking a file grants the
   * app `drive.file` access to it, so it can then be read like any owned sheet.
   */
  const openSharedProject = useCallback(async () => {
    setAuthError(null);
    try {
      const picked = await pickProjectSpreadsheet();
      if (!picked) return; // user cancelled
      const email = GoogleAuthService.getStoredProfile()?.email ?? user?.email;
      setSharedSheetIds((prev) => {
        const next = Array.from(new Set([...prev, picked.id]));
        saveSharedSheets(email, next);
        return next;
      });
      setWorkspaceMode("collaborator");
      setSpreadsheetId(null);
      setWorkspaceTree(null);
      setWorkspaceState("ready");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to open the shared project");
    }
  }, [user]);

  const removeSharedProject = useCallback(
    (sheetId: string) => {
      const email = GoogleAuthService.getStoredProfile()?.email ?? user?.email;
      setSharedSheetIds((prev) => {
        const next = prev.filter((id) => id !== sheetId);
        saveSharedSheets(email, next);
        if (next.length === 0) setWorkspaceState("no_workspace");
        return next;
      });
    },
    [user]
  );

  const logout = useCallback(() => {
    GoogleAuthService.logout();
    setUser(null);
    setSpreadsheetId(null);
    setWorkspaceTree(null);
    setSharedSheetIds([]);
    setWorkspaceMode("owner");
    setSyncStatus("idle");
    setLastSyncedAt(null);
    setWorkspaceState("no_workspace");
  }, []);

  return (
    <GoogleAuthContext.Provider
      value={{
        user,
        isConfigured,
        isPickerConfigured: isPickerConfigured(),
        isAuthenticated: !!user,
        isConnecting,
        authError,
        syncStatus,
        lastSyncedAt,
        workspaceState,
        workspaceMode,
        workspaceTree,
        spreadsheetId,
        sharedSheetIds,
        login,
        logout,
        provisionWorkspace,
        detectWorkspace,
        openSharedProject,
        removeSharedProject,
        setSyncStatus,
        markSynced,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error("useGoogleAuth must be used within a GoogleAuthProvider");
  }
  return context;
}

export type UserRole = "contractor_owner" | "shared_collaborator";

/** Lifecycle of the contractor's Google Drive workspace + master ledger sheet. */
export type WorkspaceState =
  | "loading"
  | "no_workspace"
  | "provisioning"
  | "ready"
  | "error";

export interface SharedProjectItem {
  id: string;
  code: string;
  name: string;
  clientName: string;
  location: string;
  ownerEmail: string;
  userAccessRole: "owner" | "editor" | "viewer";
  spreadsheetId: string;
  spreadsheetUrl: string;
  projectFolderId: string;
}

export interface GoogleUserProfile {
  id: string;
  name: string;
  email: string;
  picture: string;
  role: UserRole;
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface GoogleWorkspaceTree {
  rootFolderId: string;
  rootFolderName: "Construction Keeper";
  projectsFolderId: string;
  documentsFolderId: string;
  reportsFolderId: string;
  settingsFolderId: string;
  workspaceId: string;
  createdAt: string;
}

export interface ProjectWorkspaceFolders {
  projectFolderId: string;
  projectName: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  billsFolderId: string;
  photosFolderId: string;
  contractsFolderId: string;
  drawingsFolderId: string;
}

export interface HiddenProjectSettings {
  workspaceId: string;
  projectId: string;
  projectName: string;
  ownerEmail: string;
  version: string;
  createdDate: string;
}

export interface GoogleSpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  folderId?: string;
  lastSyncedAt?: string;
  isConnected: boolean;
}

export type SyncStatus = "idle" | "syncing" | "success" | "error";

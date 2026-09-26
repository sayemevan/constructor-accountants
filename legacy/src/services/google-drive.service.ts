import { googleFetch, DRIVE_API } from "@/lib/google/api-client";
import { GoogleSheetsService } from "@/services/google-sheets.service";
import { GoogleWorkspaceTree } from "@/types/google";
import {
  APP_MARKER_KEY,
  APP_MARKER_VALUE,
  APP_PROJECT_ID_KEY,
  APP_TYPE_KEY,
  MASTER_SPREADSHEET_NAME,
  MASTER_TYPE,
  PROJECT_TYPE,
  WORKSPACE_FOLDER_NAME,
} from "@/lib/google/schema";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

interface DriveFile {
  id: string;
  name: string;
  webViewLink?: string;
  appProperties?: Record<string, string>;
}

interface DriveListResponse {
  files: DriveFile[];
}

export interface ProvisionResult {
  workspaceTree: GoogleWorkspaceTree;
  spreadsheetId: string;
  spreadsheetUrl: string;
}

/**
 * Real Google Drive v3 integration.
 *
 * The app uses the narrow `drive.file` scope, so Drive only ever exposes files
 * this app created. That makes "does a workspace already exist?" a simple search
 * for our previously-created master spreadsheet.
 */
export class GoogleDriveService {
  /** Finds the app-created master ledger spreadsheet, if one exists. */
  static async findMasterSpreadsheet(): Promise<DriveFile | null> {
    const q = [
      `mimeType='${SHEET_MIME}'`,
      `appProperties has { key='${APP_MARKER_KEY}' and value='${APP_MARKER_VALUE}' }`,
      `appProperties has { key='${APP_TYPE_KEY}' and value='${MASTER_TYPE}' }`,
      "trashed=false",
    ].join(" and ");

    const res = await googleFetch<DriveListResponse>(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(
        "files(id,name,webViewLink,appProperties)"
      )}&spaces=drive`
    );
    return res.files?.[0] ?? null;
  }

  private static async createFolder(name: string, parentId?: string): Promise<string> {
    const metadata: Record<string, unknown> = { name, mimeType: FOLDER_MIME };
    if (parentId) metadata.parents = [parentId];
    const file = await googleFetch<DriveFile>(`${DRIVE_API}/files?fields=id`, {
      method: "POST",
      body: JSON.stringify(metadata),
    });
    return file.id;
  }

  private static async moveFileToFolder(fileId: string, folderId: string): Promise<void> {
    await googleFetch(
      `${DRIVE_API}/files/${fileId}?addParents=${folderId}&removeParents=root&fields=id,parents`,
      { method: "PATCH", body: JSON.stringify({}) }
    );
  }

  private static async tagAppFile(
    fileId: string,
    extra: Record<string, string> = {}
  ): Promise<void> {
    await googleFetch(`${DRIVE_API}/files/${fileId}?fields=id`, {
      method: "PATCH",
      body: JSON.stringify({
        appProperties: { [APP_MARKER_KEY]: APP_MARKER_VALUE, ...extra },
      }),
    });
  }

  /** Finds a named child folder directly under a parent folder, if it exists. */
  static async findChildFolder(parentId: string, name: string): Promise<string | null> {
    const q = [
      `mimeType='${FOLDER_MIME}'`,
      `name='${name}'`,
      `'${parentId}' in parents`,
      "trashed=false",
    ].join(" and ");
    const res = await googleFetch<DriveListResponse>(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id,name)")}`
    );
    return res.files?.[0]?.id ?? null;
  }

  /**
   * Provisions a brand new contractor workspace in Google Drive:
   * the "Construction Keeper" folder tree plus the master ledger spreadsheet.
   */
  static async provisionWorkspace(ownerEmail: string): Promise<ProvisionResult> {
    const workspaceId = `ws_ck_${Date.now().toString(36)}`;

    const rootFolderId = await this.createFolder(WORKSPACE_FOLDER_NAME);
    const [projectsFolderId, documentsFolderId, reportsFolderId, settingsFolderId] =
      await Promise.all([
        this.createFolder("Projects", rootFolderId),
        this.createFolder("Documents", rootFolderId),
        this.createFolder("Reports", rootFolderId),
        this.createFolder("Settings", rootFolderId),
      ]);

    const spreadsheet = await GoogleSheetsService.createLedgerSpreadsheet(ownerEmail, workspaceId);
    await this.tagAppFile(spreadsheet.spreadsheetId, { [APP_TYPE_KEY]: MASTER_TYPE });
    await this.moveFileToFolder(spreadsheet.spreadsheetId, rootFolderId);

    const workspaceTree: GoogleWorkspaceTree = {
      rootFolderId,
      rootFolderName: "Construction Keeper",
      projectsFolderId,
      documentsFolderId,
      reportsFolderId,
      settingsFolderId,
      workspaceId,
      createdAt: new Date().toISOString(),
    };

    return {
      workspaceTree,
      spreadsheetId: spreadsheet.spreadsheetId,
      spreadsheetUrl: spreadsheet.spreadsheetUrl,
    };
  }

  /** Reconstructs a minimal workspace tree by locating the root folder. */
  static async findWorkspaceFolder(): Promise<string | null> {
    const q = [
      `mimeType='${FOLDER_MIME}'`,
      `name='${WORKSPACE_FOLDER_NAME}'`,
      "trashed=false",
    ].join(" and ");
    const res = await googleFetch<DriveListResponse>(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id,name)")}`
    );
    return res.files?.[0]?.id ?? null;
  }

  /** Creates a project document folder under the workspace Projects folder. */
  static async createProjectFolder(projectName: string, projectsFolderId: string): Promise<string> {
    return this.createFolder(projectName, projectsFolderId);
  }

  /**
   * Provisions a single project: its own Drive folder + a dedicated project
   * spreadsheet (tagged as a project sheet and moved into the folder). This sheet
   * is what gets shared with a collaborator to grant them access to just this
   * project.
   */
  static async provisionProject(
    projectName: string,
    projectId: string,
    ownerEmail: string,
    workspaceId: string,
    parentFolderId?: string
  ): Promise<{ projectFolderId: string; spreadsheetId: string; spreadsheetUrl: string }> {
    const projectFolderId = await this.createFolder(projectName, parentFolderId || undefined);
    const spreadsheet = await GoogleSheetsService.createProjectSpreadsheet(
      projectName,
      projectId,
      ownerEmail,
      workspaceId
    );
    await this.tagAppFile(spreadsheet.spreadsheetId, {
      [APP_TYPE_KEY]: PROJECT_TYPE,
      [APP_PROJECT_ID_KEY]: projectId,
    });
    await this.moveFileToFolder(spreadsheet.spreadsheetId, projectFolderId);
    return {
      projectFolderId,
      spreadsheetId: spreadsheet.spreadsheetId,
      spreadsheetUrl: spreadsheet.spreadsheetUrl,
    };
  }

  // ---- Collaboration / sharing ----------------------------------------

  /**
   * Shares a Drive file (e.g. a project spreadsheet) with a collaborator by
   * email. `sendNotificationEmail` triggers Google's own invitation email — the
   * "request with project access" the collaborator receives.
   */
  static async shareFileWithUser(
    fileId: string,
    email: string,
    role: "writer" | "reader",
    sendNotificationEmail = true
  ): Promise<string> {
    const created = await googleFetch<{ id: string }>(
      `${DRIVE_API}/files/${fileId}/permissions?sendNotificationEmail=${sendNotificationEmail}&fields=id`,
      {
        method: "POST",
        body: JSON.stringify({ type: "user", role, emailAddress: email }),
      }
    );
    return created.id;
  }

  /** Lists who a file is currently shared with (owner must have access). */
  static async listFilePermissions(
    fileId: string
  ): Promise<{ id: string; emailAddress?: string; role: string; type: string }[]> {
    const res = await googleFetch<{
      permissions?: { id: string; emailAddress?: string; role: string; type: string }[];
    }>(
      `${DRIVE_API}/files/${fileId}/permissions?fields=${encodeURIComponent(
        "permissions(id,emailAddress,role,type)"
      )}`
    );
    return res.permissions ?? [];
  }

  /** Removes a previously granted permission (revoke access). */
  static async revokePermission(fileId: string, permissionId: string): Promise<void> {
    await googleFetch(`${DRIVE_API}/files/${fileId}/permissions/${permissionId}`, {
      method: "DELETE",
    });
  }

  /**
   * Reads a file's name and the current user's capabilities on it — used when a
   * collaborator opens a shared project to decide whether they can edit.
   */
  static async getFileAccess(
    fileId: string
  ): Promise<{ id: string; name: string; canEdit: boolean; canShare: boolean }> {
    const res = await googleFetch<{
      id: string;
      name: string;
      capabilities?: { canEdit?: boolean; canShare?: boolean };
    }>(
      `${DRIVE_API}/files/${fileId}?fields=${encodeURIComponent("id,name,capabilities(canEdit,canShare)")}`
    );
    return {
      id: res.id,
      name: res.name,
      canEdit: !!res.capabilities?.canEdit,
      canShare: !!res.capabilities?.canShare,
    };
  }
}

export { MASTER_SPREADSHEET_NAME };

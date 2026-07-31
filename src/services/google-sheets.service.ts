import { googleFetch, SHEETS_API } from "@/lib/google/api-client";
import { ConstructionProject } from "@/types/project";
import {
  DATA_TAB_HEADERS,
  EntitySchema,
  MASTER_SPREADSHEET_NAME,
  PROJECT_DATA_TAB_HEADERS,
  projectSchema,
  Row,
  SCHEMA_VERSION,
  TABS,
} from "@/lib/google/schema";

interface SpreadsheetCreateResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

interface ValuesResponse {
  values?: Row[];
}

interface AppendResponse {
  updates?: { updatedRange?: string };
}

/**
 * Real Google Sheets v4 integration. Stores all business data inside the
 * contractor's own Google Sheet (the master ledger spreadsheet).
 */
export class GoogleSheetsService {
  /**
   * Creates the master ledger spreadsheet with one tab per entity plus a hidden
   * "Settings" tab, then writes header rows and workspace metadata.
   */
  static async createLedgerSpreadsheet(
    ownerEmail: string,
    workspaceId: string
  ): Promise<SpreadsheetCreateResponse> {
    const sheets = [
      ...DATA_TAB_HEADERS.map((t) => ({ properties: { title: t.tab } })),
      { properties: { title: TABS.settings, hidden: true } },
    ];

    const created = await googleFetch<SpreadsheetCreateResponse>(SHEETS_API, {
      method: "POST",
      body: JSON.stringify({
        properties: { title: MASTER_SPREADSHEET_NAME },
        sheets,
      }),
    });

    // Write header rows for every data tab + the hidden Settings metadata.
    const data = [
      ...DATA_TAB_HEADERS.map((t) => ({
        range: `${t.tab}!A1`,
        values: [t.headers],
      })),
      {
        range: `${TABS.settings}!A1`,
        values: [
          ["key", "value"],
          ["workspaceId", workspaceId],
          ["ownerEmail", ownerEmail],
          ["version", SCHEMA_VERSION],
          ["createdDate", new Date().toISOString()],
        ],
      },
    ];

    await googleFetch(`${SHEETS_API}/${created.spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });

    return created;
  }

  /**
   * Creates a dedicated spreadsheet for a single project (Phase 2+ per-project
   * data model). It holds only that project's Workers / Payments / Transactions
   * / Materials / Members tabs, so it can be shared with one collaborator in
   * isolation. A hidden Settings tab records the owning project metadata.
   */
  static async createProjectSpreadsheet(
    projectName: string,
    projectId: string,
    ownerEmail: string,
    workspaceId: string
  ): Promise<SpreadsheetCreateResponse> {
    const sheets = [
      ...PROJECT_DATA_TAB_HEADERS.map((t) => ({ properties: { title: t.tab } })),
      { properties: { title: TABS.settings, hidden: true } },
    ];

    const created = await googleFetch<SpreadsheetCreateResponse>(SHEETS_API, {
      method: "POST",
      body: JSON.stringify({
        properties: { title: `${MASTER_SPREADSHEET_NAME} — ${projectName}` },
        sheets,
      }),
    });

    const data = [
      ...PROJECT_DATA_TAB_HEADERS.map((t) => ({
        range: `${t.tab}!A1`,
        values: [t.headers],
      })),
      {
        range: `${TABS.settings}!A1`,
        values: [
          ["key", "value"],
          ["workspaceId", workspaceId],
          ["projectId", projectId],
          ["projectName", projectName],
          ["ownerEmail", ownerEmail],
          ["version", SCHEMA_VERSION],
          ["createdDate", new Date().toISOString()],
        ],
      },
    ];

    await googleFetch(`${SHEETS_API}/${created.spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });

    return created;
  }

  /** Returns the titles of every tab in a spreadsheet. */
  static async getSheetTitles(spreadsheetId: string): Promise<string[]> {
    const res = await googleFetch<{ sheets?: { properties?: { title?: string } }[] }>(
      `${SHEETS_API}/${spreadsheetId}?fields=${encodeURIComponent("sheets.properties.title")}`
    );
    return (res.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => !!t);
  }

  /** Creates a tab (with a header row) if it does not already exist. */
  static async ensureTab(
    spreadsheetId: string,
    title: string,
    headers: string[]
  ): Promise<void> {
    const titles = await this.getSheetTitles(spreadsheetId);
    if (titles.includes(title)) return;
    await googleFetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    });
    await googleFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(title)}!A1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [headers] }) }
    );
  }

  /**
   * Writes a single-row copy of a project's registry entry into the project's
   * own spreadsheet (a "Projects" tab holding just this project). This lets an
   * invited collaborator read the project header from the shared sheet even
   * though they can't see the contractor's master ledger. Best-effort: creates
   * the tab on legacy project sheets that predate it.
   */
  static async writeProjectHeader(
    spreadsheetId: string,
    project: ConstructionProject
  ): Promise<void> {
    await this.ensureTab(spreadsheetId, projectSchema.tab, projectSchema.headers);
    // Exactly one project lives in a project sheet, on the row after the header.
    await this.updateRow(spreadsheetId, projectSchema, 2, project);
  }

  /**
   * Reads a two-column key/value tab (e.g. hidden Settings) into a plain object.
   */
  static async readKeyValues(
    spreadsheetId: string,
    tab: string = TABS.settings
  ): Promise<Record<string, string>> {
    const res = await googleFetch<ValuesResponse>(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(tab)}`
    );
    const rows = res.values ?? [];
    const out: Record<string, string> = {};
    for (let i = 1; i < rows.length; i++) {
      const [k, v] = rows[i] ?? [];
      if (k != null) out[String(k)] = v == null ? "" : String(v);
    }
    return out;
  }

  /**
   * Reads every row of a tab and deserializes them via the entity schema.
   * Returns the items plus a lookup of sheet row index (1-based) keyed by id.
   */
  static async readAll<T extends { id: string }>(
    spreadsheetId: string,
    schema: EntitySchema<T>
  ): Promise<{ items: T[]; rowIndexById: Record<string, number> }> {
    const res = await googleFetch<ValuesResponse>(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(schema.tab)}`
    );
    const rows = res.values ?? [];
    const items: T[] = [];
    const rowIndexById: Record<string, number> = {};

    // Row 0 is the header; data starts at array index 1 (sheet row 2).
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || !row[0]) continue;
      const item = schema.fromRow(row);
      items.push(item);
      rowIndexById[item.id] = i + 1; // 1-based sheet row number
    }
    return { items, rowIndexById };
  }

  /** Appends a serialized entity row and returns its 1-based sheet row index. */
  static async appendRow<T>(
    spreadsheetId: string,
    schema: EntitySchema<T>,
    item: T
  ): Promise<number> {
    const res = await googleFetch<AppendResponse>(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(
        schema.tab
      )}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        body: JSON.stringify({ values: [schema.toRow(item)] }),
      }
    );
    return this.parseRowFromRange(res.updates?.updatedRange);
  }

  /** Overwrites an existing entity row (1-based sheet row index). */
  static async updateRow<T>(
    spreadsheetId: string,
    schema: EntitySchema<T>,
    rowIndex: number,
    item: T
  ): Promise<void> {
    await googleFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(
        schema.tab
      )}!A${rowIndex}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ values: [schema.toRow(item)] }),
      }
    );
  }

  private static parseRowFromRange(range?: string): number {
    // e.g. "Workers!A7:L7" -> 7
    if (!range) return -1;
    const match = range.match(/![A-Z]+(\d+)/);
    return match ? Number(match[1]) : -1;
  }
}

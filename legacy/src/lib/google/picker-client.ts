import { GOOGLE_API_KEY, GOOGLE_APP_ID, isPickerConfigured } from "@/lib/google-config";
import { GoogleAuthService } from "@/services/google-auth.service";

/**
 * Google Picker integration.
 *
 * Under the narrow `drive.file` OAuth scope, the app cannot list files that were
 * shared with the user by someone else. The Picker is the escape hatch: when a
 * collaborator explicitly selects a shared file through the Picker, the app is
 * granted `drive.file` access to that specific file from then on. This is how an
 * invited collaborator "opens" a project that a contractor shared with them.
 */

const GAPI_SRC = "https://apis.google.com/js/api.js";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

let gapiScriptPromise: Promise<void> | null = null;
let pickerLoaded = false;

function loadGapiScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Picker can only load in the browser"));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).gapi) return Promise.resolve();
  if (gapiScriptPromise) return gapiScriptPromise;

  gapiScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GAPI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google API (gapi) script"));
    document.head.appendChild(script);
  });
  return gapiScriptPromise;
}

function loadPickerModule(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gapi = (window as any).gapi;
    if (!gapi) {
      reject(new Error("gapi unavailable"));
      return;
    }
    if (pickerLoaded) {
      resolve();
      return;
    }
    gapi.load("picker", {
      callback: () => {
        pickerLoaded = true;
        resolve();
      },
      onerror: () => reject(new Error("Failed to load Google Picker module")),
    });
  });
}

export interface PickedFile {
  id: string;
  name: string;
  url?: string;
}

/**
 * Opens the Google Picker so the user can select a shared project spreadsheet.
 * Resolves with the picked file, or `null` if the user cancels.
 */
export async function pickProjectSpreadsheet(): Promise<PickedFile | null> {
  if (!isPickerConfigured()) {
    throw new Error(
      "Google Picker is not configured. Set NEXT_PUBLIC_GOOGLE_API_KEY (and optionally NEXT_PUBLIC_GOOGLE_APP_ID)."
    );
  }

  const token = await GoogleAuthService.ensureAccessToken();
  await loadGapiScript();
  await loadPickerModule();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const picker = (window as any).google.picker;

  return new Promise<PickedFile | null>((resolve) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)
      .setMimeTypes(SHEET_MIME);

    const builder = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setCallback((data: Record<string, unknown>) => {
        const action = data[picker.Response.ACTION];
        if (action === picker.Action.PICKED) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const docs = (data[picker.Response.DOCUMENTS] as any[]) ?? [];
          const doc = docs[0];
          if (doc) {
            resolve({
              id: doc[picker.Document.ID],
              name: doc[picker.Document.NAME],
              url: doc[picker.Document.URL],
            });
            return;
          }
          resolve(null);
        } else if (action === picker.Action.CANCEL) {
          resolve(null);
        }
      });

    if (GOOGLE_APP_ID) builder.setAppId(GOOGLE_APP_ID);

    builder.build().setVisible(true);
  });
}

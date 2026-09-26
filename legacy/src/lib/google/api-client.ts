import { GoogleAuthService } from "@/services/google-auth.service";

export const DRIVE_API = "https://www.googleapis.com/drive/v3";
export const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
export const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export class GoogleApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
  }
}

/**
 * Authenticated fetch against Google REST APIs. Attaches a fresh bearer token,
 * retries once after a silent token refresh on 401, and surfaces API errors.
 */
export async function googleFetch<T = unknown>(
  url: string,
  init: RequestInit = {},
  retry = true
): Promise<T> {
  const token = await GoogleAuthService.ensureAccessToken();

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401 && retry) {
    // Token likely expired between check and use — force a refresh once.
    await GoogleAuthService.ensureAccessToken();
    return googleFetch<T>(url, init, false);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err?.error?.message || detail;
    } catch {
      /* ignore parse failure */
    }
    throw new GoogleApiError(`Google API ${res.status}: ${detail}`, res.status);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

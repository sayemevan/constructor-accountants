/**
 * Google OAuth 2.0 client configuration for browser-side Drive & Sheets access.
 *
 * This app uses the Google Identity Services (GIS) token flow, which runs entirely
 * in the browser and only requires a public OAuth Client ID — there is NO client
 * secret (that is only used for server-side OAuth flows, which this SPA does not use).
 *
 * The `drive.file` scope is intentionally narrow: the app can only see and manage
 * files that IT created, never the rest of the user's Drive.
 */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/**
 * Optional Google API key + app (project) number, used ONLY by the Google Picker
 * so an invited collaborator can open a project spreadsheet that was shared with
 * them (the narrow `drive.file` scope can't auto-discover shared files, but a file
 * the user explicitly picks becomes accessible). Get these from the same Google
 * Cloud project as the OAuth client. Picker is skipped if the API key is absent.
 */
export const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
export const GOOGLE_APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "";

export function isPickerConfigured(): boolean {
  return GOOGLE_API_KEY.trim().length > 0;
}

export const GOOGLE_OAUTH_CONFIG = {
  clientId: GOOGLE_CLIENT_ID,
  scopes: [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
  ].join(" "),
};

/** True when a Google OAuth Client ID has been provided via env. */
export function isGoogleConfigured(): boolean {
  return GOOGLE_CLIENT_ID.trim().length > 0;
}

export const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

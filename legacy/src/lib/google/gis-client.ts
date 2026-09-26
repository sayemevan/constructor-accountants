import { GOOGLE_OAUTH_CONFIG, isGoogleConfigured } from "@/lib/google-config";

const GIS_SRC = "https://accounts.google.com/gsi/client";

let gisScriptPromise: Promise<void> | null = null;
let tokenClient: TokenClient | null = null;

/** Injects and resolves once the GIS client script is available. */
export function loadGis(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("GIS can only load in the browser"));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services")));
      if (window.google?.accounts?.oauth2) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

export interface AccessTokenResult {
  accessToken: string;
  /** Absolute expiry time in epoch milliseconds. */
  expiresAt: number;
  scope: string;
}

/**
 * Requests an OAuth access token via the GIS token client.
 * @param interactive when true, always shows the Google consent/account chooser.
 *                    when false, attempts a silent token grant (no popup).
 */
export async function requestAccessToken(interactive: boolean): Promise<AccessTokenResult> {
  if (!isGoogleConfigured()) {
    throw new Error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID — Google integration is not configured.");
  }
  await loadGis();

  return new Promise<AccessTokenResult>((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services unavailable"));
      return;
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      scope: GOOGLE_OAUTH_CONFIG.scopes,
      prompt: interactive ? "consent" : "",
      callback: (response: TokenResponse) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + (response.expires_in - 60) * 1000,
          scope: response.scope,
        });
      },
      error_callback: (err) => {
        reject(new Error(err.message || err.type || "Google authorization failed"));
      },
    });

    tokenClient.requestAccessToken({ prompt: interactive ? "consent" : "" });
  });
}

/** Revokes the given access token with Google. */
export function revokeAccessToken(accessToken: string): void {
  if (typeof window !== "undefined" && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken);
  }
}

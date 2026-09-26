import { GoogleUserProfile } from "@/types/google";
import { GOOGLE_USERINFO_ENDPOINT } from "@/lib/google-config";
import { requestAccessToken, revokeAccessToken, AccessTokenResult } from "@/lib/google/gis-client";

/**
 * Real Google OAuth 2.0 (browser token flow) session manager.
 *
 * Holds the access token + expiry and the authenticated Google profile.
 * No client secret and no backend are involved — the contractor owns their data.
 */
export class GoogleAuthService {
  private static STORAGE_KEY_TOKEN = "cca_google_access_token";
  private static STORAGE_KEY_EXPIRY = "cca_google_token_expiry";
  private static STORAGE_KEY_USER = "cca_google_user_profile";

  // ---- Token storage ---------------------------------------------------

  static getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(this.STORAGE_KEY_TOKEN);
  }

  private static getExpiry(): number {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(this.STORAGE_KEY_EXPIRY) || 0);
  }

  static isTokenValid(): boolean {
    const token = this.getAccessToken();
    return !!token && Date.now() < this.getExpiry();
  }

  private static storeToken(result: AccessTokenResult): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(this.STORAGE_KEY_TOKEN, result.accessToken);
    localStorage.setItem(this.STORAGE_KEY_EXPIRY, String(result.expiresAt));
  }

  // ---- Profile storage -------------------------------------------------

  static getStoredProfile(): GoogleUserProfile | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(this.STORAGE_KEY_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as GoogleUserProfile;
    } catch {
      return null;
    }
  }

  static setStoredProfile(profile: GoogleUserProfile): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(this.STORAGE_KEY_USER, JSON.stringify(profile));
    }
  }

  // ---- OAuth actions ---------------------------------------------------

  /**
   * Returns a valid access token, silently refreshing via GIS if the current
   * one is missing or expired. Throws if a silent refresh is not possible
   * (e.g. the user must interactively re-consent).
   */
  static async ensureAccessToken(): Promise<string> {
    if (this.isTokenValid()) {
      return this.getAccessToken() as string;
    }
    const result = await requestAccessToken(false);
    this.storeToken(result);
    return result.accessToken;
  }

  /**
   * Interactive sign-in: prompts the Google account chooser / consent screen,
   * stores the token, and fetches the user's profile.
   */
  static async signIn(): Promise<GoogleUserProfile> {
    const token = await requestAccessToken(true);
    this.storeToken(token);
    const profile = await this.fetchProfile(token.accessToken);
    this.setStoredProfile(profile);
    return profile;
  }

  /** Fetches the authenticated user's Google profile (name, email, picture). */
  static async fetchProfile(accessToken: string): Promise<GoogleUserProfile> {
    const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Google profile (${res.status})`);
    }
    const data = (await res.json()) as {
      sub: string;
      name: string;
      email: string;
      picture: string;
    };
    return {
      id: data.sub,
      name: data.name,
      email: data.email,
      picture: data.picture,
      role: "contractor_owner",
    };
  }

  static logout(): void {
    const token = this.getAccessToken();
    if (token) revokeAccessToken(token);
    if (typeof window !== "undefined") {
      localStorage.removeItem(this.STORAGE_KEY_TOKEN);
      localStorage.removeItem(this.STORAGE_KEY_EXPIRY);
      localStorage.removeItem(this.STORAGE_KEY_USER);
    }
  }
}

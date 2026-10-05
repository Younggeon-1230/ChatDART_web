import type { AuthTokenResponseApi } from "@/types/api";

type StoredAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
};

const ACCESS_TOKEN_KEY = "chatdart.accessToken";
const REFRESH_TOKEN_KEY = "chatdart.refreshToken";
const TOKEN_TYPE_KEY = "chatdart.tokenType";
export const AUTH_STORAGE_EVENT = "chatdart:auth-change";

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function notifyAuthStorageChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

export function getStoredAuthTokens(): StoredAuthTokens | null {
  const storage = getBrowserStorage();
  const accessToken = storage?.getItem(ACCESS_TOKEN_KEY) ?? "";

  if (!accessToken) return null;

  return {
    accessToken,
    refreshToken: storage?.getItem(REFRESH_TOKEN_KEY) || undefined,
    tokenType: storage?.getItem(TOKEN_TYPE_KEY) || undefined,
  };
}

export function getStoredRefreshToken() {
  return getStoredAuthTokens()?.refreshToken ?? "";
}

export function hasStoredAccessToken() {
  return getStoredAuthTokens() !== null;
}

export function storeAuthTokens(response: AuthTokenResponseApi) {
  const storage = getBrowserStorage();
  if (!storage) return;

  storage.setItem(ACCESS_TOKEN_KEY, response.access_token);

  if (response.refresh_token) {
    storage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
  }

  if (response.token_type) {
    storage.setItem(TOKEN_TYPE_KEY, response.token_type);
  }

  notifyAuthStorageChanged();
}

export function clearStoredAuthTokens() {
  const storage = getBrowserStorage();
  if (!storage) return;

  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
  storage.removeItem(TOKEN_TYPE_KEY);
  notifyAuthStorageChanged();
}

export function buildAuthorizationHeader(
  tokens = getStoredAuthTokens()
): Record<string, string> {
  if (!tokens?.accessToken) return {};

  const tokenType =
    tokens.tokenType?.toLowerCase() === "bearer"
      ? "Bearer"
      : tokens.tokenType || "Bearer";
  return {
    Authorization: `${tokenType} ${tokens.accessToken}`,
  };
}

// Auth policy notes for the next integration step:
// - Access token lifetime: 30 minutes.
// - Refresh token lifetime: 7 days with rotation.
// - Confirm whether refresh tokens should be stored in an httpOnly cookie or
//   returned in JSON before wiring automatic refresh on 401 responses.

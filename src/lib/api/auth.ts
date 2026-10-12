import type {
  AuthTokenResponseApi,
  LoginRequestApi,
  RefreshTokenRequestApi,
  RegisterResponseApi,
  SignupRequestApi,
} from "@/types/api";
import { API_V1_BASE_URL } from "@/lib/apiConfig";
import {
  clearStoredAuthTokens,
  getStoredRefreshToken,
} from "@/lib/authTokens";
import { request, requestRefreshToken } from "@/lib/api/client";

export async function login(
  payload: LoginRequestApi
): Promise<AuthTokenResponseApi> {
  return request<AuthTokenResponseApi>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
      authMode: "none",
    },
    API_V1_BASE_URL
  );
}

export async function register(
  payload: SignupRequestApi
): Promise<RegisterResponseApi> {
  return request<RegisterResponseApi>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(payload),
      authMode: "none",
    },
    API_V1_BASE_URL
  );
}

export async function refreshToken(
  refreshTokenValue: string
): Promise<AuthTokenResponseApi> {
  return requestRefreshToken(refreshTokenValue);
}

export async function logout(refreshTokenValue: string): Promise<void> {
  const payload: RefreshTokenRequestApi = {
    refresh_token: refreshTokenValue,
  };

  return request<void>(
    "/auth/logout",
    {
      method: "POST",
      body: JSON.stringify(payload),
      authMode: "required",
      allowEmptyResponse: true,
      skipAuthRefresh: true,
    },
    API_V1_BASE_URL
  );
}

export async function logoutCurrentUser(): Promise<void> {
  const refreshTokenValue = getStoredRefreshToken();

  try {
    if (refreshTokenValue) {
      await logout(refreshTokenValue);
    }
  } finally {
    clearStoredAuthTokens();
  }
}

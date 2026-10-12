import type {
  ApiErrorCode,
  ApiErrorResponse,
  AuthTokenResponseApi,
} from "@/types/api";
import {
  API_BASE_URL,
  API_V1_BASE_URL,
  joinApiUrl,
  readPositiveNumberEnv,
} from "@/lib/apiConfig";
import {
  buildAuthorizationHeader,
  clearStoredAuthTokens,
  getStoredRefreshToken,
  storeAuthTokens,
} from "@/lib/authTokens";
import { getApiErrorMessage, parseApiErrorBody } from "@/lib/apiErrors";

const API_TIMEOUT_MS = readPositiveNumberEnv(
  process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
  5000
);

export type BackendStep = "collect" | "summary";

export type ApiRequestInit = RequestInit & {
  headers?: Record<string, string>;
  timeoutMs?: number;
  step?: BackendStep;
  allowEmptyResponse?: boolean;
  authMode?: "none" | "optional" | "required";
  skipAuthRefresh?: boolean;
};

export function createHttpError(
  message: string,
  status?: number
): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

class ApiHttpError extends Error {
  code?: ApiErrorCode;
  detail?: ApiErrorResponse["detail"];
  step: BackendStep | "api";
  status: number;
  body?: string;
  userMessage?: string;

  constructor(
    step: BackendStep | "api",
    status: number,
    body?: string,
    userMessage?: string,
    code?: ApiErrorCode,
    detail?: ApiErrorResponse["detail"]
  ) {
    super(`${step} http error: ${status}`);
    this.name = "ApiHttpError";
    this.step = step;
    this.status = status;
    this.body = body;
    this.userMessage = userMessage;
    this.code = code;
    this.detail = detail;
  }
}

export class ApiParseError extends Error {
  step: BackendStep | "api";
  rawText?: string;

  constructor(step: BackendStep | "api", rawText?: string) {
    super(`${step} parse error`);
    this.name = "ApiParseError";
    this.step = step;
    this.rawText = rawText;
  }
}

let refreshRequestPromise: Promise<boolean> | null = null;

function getRequestAuthMode(init?: ApiRequestInit) {
  return init?.authMode ?? "optional";
}

function buildRequestHeaders(
  init: ApiRequestInit | undefined,
  shouldSetJsonContentType: boolean
) {
  const authMode = getRequestAuthMode(init);
  const authHeader =
    authMode === "none" ? {} : buildAuthorizationHeader();

  return {
    ...(shouldSetJsonContentType ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers ?? {}),
    ...authHeader,
  };
}

export async function requestRefreshToken(
  refreshTokenValue: string
): Promise<AuthTokenResponseApi> {
  return request<AuthTokenResponseApi>(
    "/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshTokenValue }),
      authMode: "none",
      skipAuthRefresh: true,
    },
    API_V1_BASE_URL
  );
}

export async function refreshStoredAuthTokens() {
  if (refreshRequestPromise) return refreshRequestPromise;

  const refreshTokenValue = getStoredRefreshToken();

  if (!refreshTokenValue) {
    return false;
  }

  refreshRequestPromise = requestRefreshToken(refreshTokenValue)
    .then((response) => {
      storeAuthTokens(response);
      return true;
    })
    .catch(() => {
      clearStoredAuthTokens();
      return false;
    })
    .finally(() => {
      refreshRequestPromise = null;
    });

  return refreshRequestPromise;
}

export async function request<T>(
  path: string,
  init?: ApiRequestInit,
  baseUrl = API_BASE_URL
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? API_TIMEOUT_MS;
  const step = init?.step ?? "api";
  const requestUrl = joinApiUrl(baseUrl, path);
  const method = init?.method?.toUpperCase() ?? "GET";
  const shouldSetJsonContentType =
    method !== "GET" &&
    method !== "HEAD" &&
    !(init?.body instanceof FormData);

  async function executeNetworkAttempt() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(requestUrl, {
        ...init,
        headers: buildRequestHeaders(init, shouldSetJsonContentType),
        cache: "no-store",
        signal: controller.signal,
      });

      const rawText = await response.text().catch(() => "");
      return { response, rawText };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw createHttpError(
          "요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
          408
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function executeRequest(hasRetriedAfterRefresh: boolean): Promise<T> {
    const { response, rawText } = await executeNetworkAttempt();

    if (!response.ok) {
      let errorBody: ApiErrorResponse | null = null;

      try {
        errorBody = rawText ? (JSON.parse(rawText) as ApiErrorResponse) : null;
      } catch {
        errorBody = null;
      }

      const parsedError = parseApiErrorBody(errorBody);
      const error = new ApiHttpError(
        step,
        response.status,
        rawText,
        parsedError.message || undefined,
        parsedError.code,
        parsedError.detail
      );
      error.message = getApiErrorMessage(error);

      if (
        response.status === 401 &&
        !hasRetriedAfterRefresh &&
        !init?.skipAuthRefresh &&
        getRequestAuthMode(init) !== "none"
      ) {
        const refreshed = await refreshStoredAuthTokens();

        if (refreshed) {
          return executeRequest(true);
        }
      }

      throw error;
    }

    let data: T | null = null;

    try {
      data = rawText ? (JSON.parse(rawText) as T) : null;
    } catch {
      throw new ApiParseError(step, rawText);
    }

    if (data === null && init?.allowEmptyResponse) {
      return undefined as T;
    }

    if (data === null) {
      throw new ApiParseError(step, rawText);
    }

    return data;
  }

  return executeRequest(false);
}

export function authorizedApiRequest<T>(path: string, init?: ApiRequestInit) {
  return request<T>(
    path,
    {
      ...init,
      headers: {
        ...buildAuthorizationHeader(),
        ...(init?.headers ?? {}),
      },
      authMode: "required",
    },
    API_V1_BASE_URL
  );
}

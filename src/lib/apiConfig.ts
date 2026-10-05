const DEFAULT_API_ORIGIN = "http://localhost:8000";
const DEFAULT_API_PATH = "/api/v1/finance";

function normalizeOrigin(value: string) {
  return value.replace(/\/api\/v1(?:\/finance)?\/?$/, "").replace(/\/$/, "");
}

function normalizeFinanceBaseUrl(value: string) {
  const normalizedValue = value.replace(/\/$/, "");

  if (/\/api\/v1\/finance$/.test(normalizedValue)) {
    return normalizedValue;
  }

  if (/\/api\/v1$/.test(normalizedValue)) {
    return `${normalizedValue}/finance`;
  }

  return `${normalizedValue}${DEFAULT_API_PATH}`;
}

const API_ORIGIN = normalizeOrigin(
  process.env.NEXT_PUBLIC_API_ORIGIN ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_API_ORIGIN
);

export const API_BASE_URL = normalizeFinanceBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? API_ORIGIN
);

export const API_V1_BASE_URL =
  process.env.NEXT_PUBLIC_API_V1_BASE_URL ??
  `${API_ORIGIN}/api/v1`;

export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

export const ENABLE_MOCK_FALLBACK =
  process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === "true" || USE_MOCK_API;

export const ENABLE_AI_ANALYSIS =
  process.env.NEXT_PUBLIC_ENABLE_AI_ANALYSIS === "true";

export function readPositiveNumberEnv(
  value: string | undefined,
  fallback: number
) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function joinApiUrl(baseUrl: string, path: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
}

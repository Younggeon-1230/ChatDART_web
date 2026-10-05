import { mockSearchResultsApi } from "@/mock/api";
import {
  API_BASE_URL,
  ENABLE_MOCK_FALLBACK,
  joinApiUrl,
  readPositiveNumberEnv,
} from "@/lib/apiConfig";
import { refreshStoredAuthTokens } from "@/lib/api";
import {
  buildAuthorizationHeader,
  hasStoredAccessToken,
} from "@/lib/authTokens";
import {
  getApiErrorMessage,
  getFinanceServiceUnavailableKind,
  parseApiErrorBody,
} from "@/lib/apiErrors";

type NormalizedCompanyQuery = {
  original: string;
  trimmed: string;
  collapsed: string;
  lowerCased: string;
  withoutSpaces: string;
};

export type CompanySearchItem = {
  corpCode?: string | null;
  stockCode?: string | null;
  corpName?: string | null;
  companyName?: string | null;
  name: string;
  displayName?: string | null;
  matchedName?: string | null;
  market?: string | null;
  sector?: string | null;
  industry?: string | null;
  business?: string | null;
  isCollected?: boolean;
};

export type CompanyAnalysisTarget = {
  keyword: string;
  corpCode?: string;
  stockCode?: string;
  displayName?: string;
};

export type CompanySearchResponse = {
  query: string;
  results: CompanySearchItem[];
  suggestions?: CompanySearchItem[];
  dataSource: "api" | "mock";
};

type LegacyCompanySearchItem = {
  name?: string | null;
  code?: string | null;
  displayName?: string | null;
  display_name?: string | null;
  matchedName?: string | null;
  matched_name?: string | null;
  companyName?: string | null;
  company_name?: string | null;
  corpName?: string | null;
  corp_name?: string | null;
  corpCode?: string | null;
  corp_code?: string | null;
  stockCode?: string | null;
  stock_code?: string | null;
  market?: string | null;
  sector?: string | null;
  industry?: string | null;
  business?: string | null;
  is_collected?: boolean | null;
  isCollected?: boolean | null;
};

type RawCompanySearchResponse =
  | LegacyCompanySearchItem[]
  | LegacyCompanySearchItem
  | {
      query?: string;
      results?: LegacyCompanySearchItem[];
      suggestions?: LegacyCompanySearchItem[];
    };

const COMPANY_SEARCH_BASE_URL = API_BASE_URL;
const COMPANY_SEARCH_TIMEOUT_MS = readPositiveNumberEnv(
  process.env.NEXT_PUBLIC_SEARCH_TIMEOUT_MS,
  2500
);
export const MIN_BACKEND_LOADING_MS = Number(
  process.env.NEXT_PUBLIC_MIN_BACKEND_LOADING_MS ?? 1200
);

export function normalizeCompanyQuery(query: string): NormalizedCompanyQuery {
  const trimmed = query.trim();
  const collapsed = trimmed.replace(/\s+/g, " ");
  const lowerCased = collapsed.toLowerCase();
  const compact = lowerCased.replace(/\s/g, "").replace(/[·.\-_]/g, "");

  return {
    original: query,
    trimmed,
    collapsed,
    lowerCased,
    withoutSpaces: compact,
  };
}

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function getCompanyDisplayName(company: CompanySearchItem) {
  return (
    cleanOptionalText(company.displayName) ??
    cleanOptionalText(company.corpName) ??
    cleanOptionalText(company.companyName) ??
    cleanOptionalText(company.name) ??
    cleanOptionalText(company.matchedName) ??
    ""
  );
}

export function toCompanyAnalysisTarget(
  company: CompanySearchItem,
  fallbackKeyword: string
): CompanyAnalysisTarget {
  const keyword =
    cleanOptionalText(company.corpName) ??
    cleanOptionalText(company.companyName) ??
    cleanOptionalText(company.displayName) ??
    cleanOptionalText(company.name) ??
    cleanOptionalText(fallbackKeyword) ??
    "";
  const displayName = cleanOptionalText(company.displayName) ?? keyword;

  return {
    keyword,
    corpCode: cleanOptionalText(company.corpCode),
    stockCode: cleanOptionalText(company.stockCode),
    displayName,
  };
}

export function buildCompanyAnalysisUrl(
  path: "/summary" | "/detail",
  target: CompanyAnalysisTarget
) {
  const params = new URLSearchParams();

  if (target.keyword) params.set("keyword", target.keyword);
  if (target.corpCode) params.set("corpCode", target.corpCode);
  if (target.stockCode) params.set("stockCode", target.stockCode);
  if (target.displayName) params.set("displayName", target.displayName);

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function buildSearchUrl(query: string) {
  const url = new URL(joinApiUrl(COMPANY_SEARCH_BASE_URL, "/search"));
  url.searchParams.set("keyword", query);
  return url.toString();
}

function getCompanyMatchKeys(company: CompanySearchItem) {
  return [
    company.displayName,
    company.corpName,
    company.companyName,
    company.name,
    company.matchedName,
    company.stockCode,
    company.corpCode,
  ]
    .map((value) =>
      typeof value === "string"
        ? normalizeCompanyQuery(value).withoutSpaces
        : ""
    )
    .filter(Boolean);
}

export function findBestCompanySearchMatch(
  companies: CompanySearchItem[],
  query: string
) {
  const normalizedQuery = normalizeCompanyQuery(query).withoutSpaces;

  if (!normalizedQuery) {
    return companies[0] ?? null;
  }

  return (
    companies.find((company) =>
      getCompanyMatchKeys(company).some((key) => key === normalizedQuery)
    ) ??
    companies.find((company) =>
      getCompanyMatchKeys(company).some(
        (key) => key.includes(normalizedQuery) || normalizedQuery.includes(key)
      )
    ) ??
    companies[0] ??
    null
  );
}

function toCompanySearchItem(
  item: LegacyCompanySearchItem
): CompanySearchItem | null {
  const name =
    item.name ??
    item.corpName ??
    item.corp_name ??
    item.companyName ??
    item.company_name ??
    item.displayName ??
    item.display_name;

  if (!name?.trim()) {
    return null;
  }

  const stockCode = item.stockCode ?? item.stock_code ?? item.code;
  const corpCode = item.corpCode ?? item.corp_code;

  return {
    corpCode,
    stockCode,
    corpName: item.corpName ?? item.corp_name,
    companyName: item.companyName ?? item.company_name,
    name: name.trim(),
    displayName: item.displayName ?? item.display_name ?? name.trim(),
    matchedName: item.matchedName ?? item.matched_name,
    market: item.market,
    sector: item.sector,
    industry: item.industry,
    business: item.business,
    isCollected: item.is_collected ?? item.isCollected ?? undefined,
  };
}

function normalizeItems(items?: LegacyCompanySearchItem[]) {
  return (items ?? [])
    .map(toCompanySearchItem)
    .filter((item): item is CompanySearchItem => item !== null);
}

function searchMockCompanies(query: string) {
  const normalizedQuery = normalizeCompanyQuery(query).withoutSpaces;

  if (!normalizedQuery) return [];

  return mockSearchResultsApi
    .filter((company) => {
      const candidates = [
        company.name,
        company.code,
        company.corpName,
        company.companyName,
        company.displayName,
        company.matchedName,
        company.stockCode,
        company.corpCode,
        company.market,
        company.sector,
        company.industry,
      ]
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalizeCompanyQuery(value).withoutSpaces);

      return candidates.some((candidate) =>
        candidate.includes(normalizedQuery)
      );
    })
    .slice(0, 8);
}

function normalizeSearchResponse(
  data: RawCompanySearchResponse,
  fallbackQuery: string
): CompanySearchResponse {
  if (Array.isArray(data)) {
    return {
      query: fallbackQuery,
      results: normalizeItems(data),
      dataSource: "api",
    };
  }

  if (!("results" in data) && !("suggestions" in data)) {
    const singleItem = toCompanySearchItem(data as LegacyCompanySearchItem);

    if (!singleItem) {
      return {
        query: fallbackQuery,
        results: [],
        suggestions: [],
        dataSource: "api",
      };
    }

    return {
      query: fallbackQuery,
      results: [singleItem],
      suggestions: [],
      dataSource: "api",
    };
  }

  return {
    query: data.query ?? fallbackQuery,
    results: normalizeItems(data.results),
    suggestions: normalizeItems(data.suggestions),
    dataSource: "api",
  };
}

function hasSearchResults(response: CompanySearchResponse) {
  return response.results.length > 0 || (response.suggestions?.length ?? 0) > 0;
}

function buildSearchQueryVariants(query: string) {
  const normalized = normalizeCompanyQuery(query);
  const upperCased = normalized.collapsed.replace(/[a-z]/g, (char) =>
    char.toUpperCase()
  );

  return [...new Set([normalized.collapsed, upperCased])].filter(Boolean);
}

function getMockCompanySearchResponse(query: string): CompanySearchResponse {
  const normalized = normalizeCompanyQuery(query);
  const results = normalizeItems(searchMockCompanies(normalized.collapsed));

  return {
    query: normalized.collapsed,
    results,
    suggestions: [],
    dataSource: "mock",
  };
}

function createSearchError(
  error: unknown
): Error {
  if (error instanceof DOMException && error.name === "AbortError") {
    const timeoutError = new Error(
      "검색 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요."
    );
    return timeoutError;
  }

  if (error instanceof Error) {
    const searchError = error;
    searchError.message = getApiErrorMessage(
      searchError,
      searchError.message || "검색 결과를 불러오지 못했습니다."
    );
    return searchError;
  }

  const unknownError = new Error("검색 결과를 불러오지 못했습니다.");
  return unknownError;
}

function shouldUseFinanceSearchMockFallback(error: unknown) {
  const status = (error as { status?: unknown })?.status;

  if (status === 401 || status === 403) {
    return false;
  }

  const serviceUnavailableKind = getFinanceServiceUnavailableKind(error);
  return (
    serviceUnavailableKind !== "loading" &&
    serviceUnavailableKind !== "init_failed"
  );
}

async function parseSearchJson(response: Response): Promise<RawCompanySearchResponse> {
  try {
    return (await response.json()) as RawCompanySearchResponse;
  } catch {
    throw new Error("검색 응답 형식이 올바르지 않습니다.");
  }
}

function buildSearchHeaders() {
  return {
    ...buildAuthorizationHeader(),
    "ngrok-skip-browser-warning": "true",
  };
}

async function fetchSearchResponse(
  requestUrl: string,
  signal: AbortSignal,
  hasRetriedAfterRefresh = false
) {
  const response = await fetch(requestUrl, {
    headers: buildSearchHeaders(),
    cache: "no-store",
    signal,
  });

  if (
    response.status === 401 &&
    hasStoredAccessToken() &&
    !hasRetriedAfterRefresh
  ) {
    const refreshed = await refreshStoredAuthTokens();

    if (refreshed) {
      return fetchSearchResponse(requestUrl, signal, true);
    }
  }

  return response;
}

export async function searchCompanies(
  query: string,
  options?: {
    timeoutMs?: number;
    enableMockFallback?: boolean;
  }
): Promise<CompanySearchResponse> {
  const normalized = normalizeCompanyQuery(query);
  const timeoutMs = options?.timeoutMs ?? COMPANY_SEARCH_TIMEOUT_MS;
  const enableMockFallback =
    options?.enableMockFallback ?? ENABLE_MOCK_FALLBACK;

  if (!normalized.collapsed) {
    return { query: "", results: [], dataSource: "api" };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    let emptyResponse: CompanySearchResponse | null = null;

    for (const searchQuery of buildSearchQueryVariants(normalized.collapsed)) {
      const requestUrl = buildSearchUrl(searchQuery);

      const response = await fetchSearchResponse(requestUrl, controller.signal);

      if (!response.ok) {
        const error = new Error("검색 결과를 불러오지 못했습니다.") as Error & {
          status?: number;
          userMessage?: string;
        };
        error.status = response.status;
        const rawText = await response.text().catch(() => "");

        try {
          const errorBody = rawText ? JSON.parse(rawText) : null;
          const parsedError = parseApiErrorBody(errorBody);
          if (parsedError.message) {
            error.userMessage = parsedError.message;
          }
        } catch {
          error.userMessage = undefined;
        }

        error.message = getApiErrorMessage(error, error.message);
        throw error;
      }

      const data = await parseSearchJson(response);
      const normalizedResponse = normalizeSearchResponse(
        data,
        normalized.collapsed
      );

      if (hasSearchResults(normalizedResponse)) {
        return normalizedResponse;
      }

      emptyResponse = normalizedResponse;
    }

    return (
      emptyResponse ?? {
        query: normalized.collapsed,
        results: [],
        suggestions: [],
        dataSource: "api",
      }
    );
  } catch (error) {
    if (enableMockFallback && shouldUseFinanceSearchMockFallback(error)) {
      return getMockCompanySearchResponse(normalized.collapsed);
    }

    throw createSearchError(error);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

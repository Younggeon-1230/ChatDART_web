import type {
  ApiErrorResponse,
  ApiDataSourceMeta,
  AiAnalysisResponse,
  AuthTokenResponseApi,
  CollectResponseApi,
  CompareShareSaveResponseApi,
  CompareShareResponseApi,
  CompanySummaryApiResponse,
  CollectionStatusResponseApi,
  DashboardResponseApi,
  FinancialDisclosuresResponseApi,
  LoginRequestApi,
  InsightInterpretationRequestApi,
  InsightInterpretationResponseApi,
  InsightInterpretationFlagApi,
  MembershipPlanItemApi,
  MembershipPlansResponseApi,
  PopularCompaniesResponseApi,
  PopularCompaniesWindow,
  RecommendedCompanyApi,
  RefreshTokenRequestApi,
  SignupRequestApi,
  RegisterResponseApi,
  SimilarCompaniesResponseApi,
  SimilarCompanyApi,
  SummaryDetailApiResponse,
  UserMembershipApi,
  WatchlistCreateRequestApi,
  WatchlistMutationResponseApi,
  WatchlistPostResponseApi,
  WatchlistSummaryItemApi,
  WatchlistSummariesResponseApi,
  WatchlistUpdateRequestApi,
} from "@/types/api";
import type { FinancialInsight } from "@/lib/financialInsights";
import {
  mockCollectStartedApi,
  mockFinancialSummaryApiResponse,
  mockKnownCompaniesApi,
  mockSearchResultsApi,
  mockSummaryApiResponse,
} from "@/mock/api";
import type { CompanyAnalysisTarget } from "@/lib/companySearch";
import {
  API_BASE_URL,
  API_V1_BASE_URL,
  ENABLE_AI_ANALYSIS,
  ENABLE_MOCK_FALLBACK,
  USE_MOCK_API,
  joinApiUrl,
  readPositiveNumberEnv,
} from "@/lib/apiConfig";
import {
  buildAuthorizationHeader,
  clearStoredAuthTokens,
  getStoredRefreshToken,
  storeAuthTokens,
} from "@/lib/authTokens";
import {
  getApiErrorMessage,
  getApiErrorStatus,
  getFinanceServiceUnavailableKind,
  isRateLimitError,
  parseApiErrorBody,
} from "@/lib/apiErrors";
import {
  isRecord,
  normalizeCompanySummaryResponse,
  normalizeYearlyFinancialData,
  sortFinancialHistory,
} from "@/lib/financialNormalize";

const API_TIMEOUT_MS = readPositiveNumberEnv(
  process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
  5000
);
export const COLLECT_TIMEOUT_MS = readPositiveNumberEnv(
  process.env.NEXT_PUBLIC_COLLECT_TIMEOUT_MS,
  10000
);
export const SUMMARY_TIMEOUT_MS = readPositiveNumberEnv(
  process.env.NEXT_PUBLIC_SUMMARY_TIMEOUT_MS,
  45000
);
export const AI_ANALYSIS_TIMEOUT_MS = readPositiveNumberEnv(
  process.env.NEXT_PUBLIC_AI_ANALYSIS_TIMEOUT_MS,
  30000
);

type ApiRequestInit = RequestInit & {
  headers?: Record<string, string>;
  timeoutMs?: number;
  step?: BackendStep;
  includeApiKey?: boolean;
  allowEmptyResponse?: boolean;
  authMode?: "none" | "optional" | "required";
  skipAuthRefresh?: boolean;
};

type QueryValue = string | number | boolean | null | undefined;

function trimKeyword(keyword: string): string {
  return keyword.trim();
}

function normalizeMockCompanyKey(value: string) {
  return trimKeyword(value).replace(/\s+/g, "").toLowerCase();
}

type CompanyAnalysisRequest = string | CompanyAnalysisTarget;

function normalizeAnalysisTarget(
  request: CompanyAnalysisRequest
): CompanyAnalysisTarget {
  if (typeof request === "string") {
    const keyword = trimKeyword(request);
    return {
      keyword,
      displayName: keyword,
    };
  }

  const keyword = trimKeyword(request.keyword);

  return {
    keyword,
    corpCode: request.corpCode?.trim() || undefined,
    stockCode: request.stockCode?.trim() || undefined,
    displayName: request.displayName?.trim() || keyword,
  };
}

function buildAnalysisQuery(
  target: CompanyAnalysisTarget,
  extra?: Record<string, QueryValue>
) {
  return buildQuery({
    keyword: target.keyword,
    corpCode: target.corpCode,
    stockCode: target.stockCode,
    ...extra,
  });
}

function buildQuery(params: Record<string, QueryValue>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildRepeatedQuery(
  repeatedKey: string,
  values: Array<string | null | undefined>,
  params?: Record<string, QueryValue>
): string {
  const searchParams = new URLSearchParams();

  values
    .map((value) => value?.trim())
    .filter((value): value is string => !!value)
    .forEach((value) => {
      searchParams.append(repeatedKey, value);
    });

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function createHttpError(
  message: string,
  status?: number
): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

type BackendStep = "collect" | "summary";

class ApiHttpError extends Error {
  step: BackendStep | "api";
  status: number;
  body?: string;
  userMessage?: string;

  constructor(
    step: BackendStep | "api",
    status: number,
    body?: string,
    userMessage?: string
  ) {
    super(`${step} http error: ${status}`);
    this.name = "ApiHttpError";
    this.step = step;
    this.status = status;
    this.body = body;
    this.userMessage = userMessage;
  }
}

class ApiParseError extends Error {
  step: BackendStep | "api";
  rawText?: string;

  constructor(step: BackendStep | "api", rawText?: string) {
    super(`${step} parse error`);
    this.name = "ApiParseError";
    this.step = step;
    this.rawText = rawText;
  }
}

function withDataSource<T extends object>(
  data: T,
  dataSource: "api" | "api-partial" | "mock"
): T & ApiDataSourceMeta {
  return {
    ...data,
    __dataSource: dataSource,
  };
}

let refreshRequestPromise: Promise<boolean> | null = null;

export function getUserFriendlyApiErrorMessage(
  error: unknown,
  fallback = "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
) {
  if (error instanceof ApiParseError) {
    return "응답 형식이 올바르지 않아 데이터를 표시하지 못했습니다.";
  }

  return getApiErrorMessage(error, fallback);
}

export { getApiErrorStatus, isRateLimitError };
export { getFinanceServiceUnavailableKind };
export { ENABLE_AI_ANALYSIS };

function shouldUseFinanceMockFallback(error: unknown) {
  const status = getApiErrorStatus(error);

  if (status === 401 || status === 403) {
    return false;
  }

  const serviceUnavailableKind = getFinanceServiceUnavailableKind(error);
  return (
    serviceUnavailableKind !== "loading" &&
    serviceUnavailableKind !== "init_failed"
  );
}

export function getAiAnalysisErrorMessage(error: unknown) {
  const status = getApiErrorStatus(error);

  switch (status) {
    case 401:
    case 403:
      return "인증이 필요합니다. 다시 로그인해 주세요.";
    case 404:
      return "AI 분석에 사용할 수집 데이터가 없습니다. 먼저 데이터를 수집해 주세요.";
    case 408:
      return "연결 상태를 확인한 뒤 잠시 후 다시 시도해 주세요.";
    case 422:
      return "AI 분석에 필요한 최근 데이터가 부족합니다.";
    case 429:
      return "AI 분석 요청이 많습니다. 잠시 후 다시 시도해 주세요.";
    case 503:
      return "AI 분석을 잠시 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
    default:
      if (typeof status === "number" && status >= 500) {
        return "AI 분석 중 일시적인 오류가 발생했습니다.";
      }

      if (error instanceof TypeError) {
        return "연결 상태를 확인한 뒤 잠시 후 다시 시도해 주세요.";
      }

      return "AI 분석 결과를 불러오지 못했습니다.";
  }
}

function normalizeAiPrediction(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeAiAnalysisResponse(
  response: AiAnalysisResponse,
  keyword: string
): AiAnalysisResponse {
  return {
    ...response,
    stock_code:
      typeof response.stock_code === "string" && response.stock_code.trim()
        ? response.stock_code.trim()
        : keyword,
    company_name:
      typeof response.company_name === "string" && response.company_name.trim()
        ? response.company_name.trim()
        : "",
    prediction: normalizeAiPrediction(response.prediction),
    prediction_label:
      typeof response.prediction_label === "string" &&
      response.prediction_label.trim()
        ? response.prediction_label.trim()
        : null,
    summary:
      typeof response.summary === "string" && response.summary.trim()
        ? response.summary.trim()
        : "",
  };
}

function resolveKnownMockCompany(keyword: string, stockCode?: string) {
  const normalizedKeyword = normalizeMockCompanyKey(keyword);
  const normalizedStockCode = stockCode?.trim();

  return (
    mockKnownCompaniesApi.find((company) => {
      const companyStockCode = company.stockCode ?? company.code;

      if (normalizedStockCode && companyStockCode === normalizedStockCode) {
        return true;
      }

      const candidates = [
        company.name,
        company.companyName,
        company.displayName,
        company.corpName,
        company.code,
        company.stockCode,
      ]
        .filter((value): value is string => typeof value === "string")
        .map(normalizeMockCompanyKey);

      return candidates.some((candidate) => candidate === normalizedKeyword);
    }) ?? null
  );
}

function applyMockCompanyIdentity(
  template: CompanySummaryApiResponse,
  companyName: string,
  stockCode: string
): CompanySummaryApiResponse {
  return {
    ...template,
    company_name: companyName,
    stock_code: stockCode,
    summary_text: template.summary_text.replaceAll(
      template.company_name,
      companyName
    ),
    history: template.history.map((item) => ({
      ...item,
      source_report: item.source_report?.replaceAll(
        template.company_name,
        companyName
      ),
    })),
  };
}

function getRequestAuthMode(init?: ApiRequestInit) {
  if (init?.authMode) return init.authMode;
  return init?.includeApiKey === false ? "none" : "optional";
}

function buildRequestHeaders(
  init: ApiRequestInit | undefined,
  shouldSetJsonContentType: boolean
) {
  const authMode = getRequestAuthMode(init);
  const authHeader =
    authMode === "none" ? {} : buildAuthorizationHeader();
  return {
    "ngrok-skip-browser-warning": "true",
    ...(shouldSetJsonContentType ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers ?? {}),
    ...authHeader,
  };
}

export async function refreshStoredAuthTokens() {
  if (refreshRequestPromise) return refreshRequestPromise;

  const refreshTokenValue = getStoredRefreshToken();

  if (!refreshTokenValue) {
    return false;
  }

  refreshRequestPromise = refreshToken(refreshTokenValue)
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

function pickMockSummary(
  keyword: string,
  stockCode?: string
): CompanySummaryApiResponse {
  const normalizedKeyword = normalizeMockCompanyKey(keyword);
  const knownCompany = resolveKnownMockCompany(keyword, stockCode);
  const displayName = knownCompany?.name ?? trimKeyword(keyword);
  const template =
    normalizedKeyword.includes("화재") || normalizedKeyword.includes("보험")
      ? mockFinancialSummaryApiResponse
      : mockSummaryApiResponse;

  return applyMockCompanyIdentity(
    template,
    displayName || template.company_name,
    knownCompany?.stockCode ?? knownCompany?.code ?? ""
  );
}

async function request<T>(
  path: string,
  init?: ApiRequestInit,
  baseUrl = API_BASE_URL
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = init?.timeoutMs ?? API_TIMEOUT_MS;
  const step = init?.step ?? "api";
  const requestUrl = joinApiUrl(baseUrl, path);

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const method = init?.method?.toUpperCase() ?? "GET";
  const shouldSetJsonContentType =
    method !== "GET" &&
    method !== "HEAD" &&
    !(init?.body instanceof FormData);

  async function executeRequest(hasRetriedAfterRefresh: boolean): Promise<T> {
    const response = await fetch(requestUrl, {
      ...init,
      headers: buildRequestHeaders(init, shouldSetJsonContentType),
      cache: "no-store",
      signal: controller.signal,
    });

    const rawText = await response.text().catch(() => "");

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
        parsedError.message || undefined
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

  try {
    return await executeRequest(false);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw createHttpError(
        "?붿껌 ?쒓컙??珥덇낵?섏뿀?듬땲?? ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.",
        408
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function authorizedApiRequest<T>(path: string, init?: ApiRequestInit) {
  return request<T>(
    path,
    {
      ...init,
      headers: {
        ...buildAuthorizationHeader(),
        ...(init?.headers ?? {}),
      },
      includeApiKey: false,
      authMode: "required",
    },
    API_V1_BASE_URL
  );
}

export async function login(
  payload: LoginRequestApi
): Promise<AuthTokenResponseApi> {
  return request<AuthTokenResponseApi>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
      includeApiKey: false,
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
      includeApiKey: false,
      authMode: "none",
    },
    API_V1_BASE_URL
  );
}

async function refreshToken(
  refreshTokenValue: string
): Promise<AuthTokenResponseApi> {
  const payload: RefreshTokenRequestApi = {
    refresh_token: refreshTokenValue,
  };

  return request<AuthTokenResponseApi>(
    "/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify(payload),
      includeApiKey: false,
      authMode: "none",
      skipAuthRefresh: true,
    },
    API_V1_BASE_URL
  );
}

function normalizeMembershipPlansResponse(
  response: MembershipPlanItemApi[] | MembershipPlansResponseApi
): MembershipPlanItemApi[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.items)) {
    return response.items;
  }

  if (Array.isArray(response.plans)) {
    return response.plans;
  }

  return [];
}

export async function getMembershipPlans(): Promise<MembershipPlanItemApi[]> {
  const response = await request<
    MembershipPlanItemApi[] | MembershipPlansResponseApi
  >(
    "/membership/plans",
    {
      includeApiKey: false,
      authMode: "none",
    },
    API_V1_BASE_URL
  );

  return normalizeMembershipPlansResponse(response);
}

export async function getMyMembership(): Promise<UserMembershipApi> {
  return authorizedApiRequest<UserMembershipApi>("/membership/me");
}

async function logout(refreshTokenValue: string): Promise<void> {
  const payload: RefreshTokenRequestApi = {
    refresh_token: refreshTokenValue,
  };

  return request<void>(
    "/auth/logout",
    {
      method: "POST",
      body: JSON.stringify(payload),
      includeApiKey: false,
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

export async function startCollection(
  requestTarget: CompanyAnalysisRequest
): Promise<CollectResponseApi> {
  const target = normalizeAnalysisTarget(requestTarget);
  const trimmedKeyword = target.keyword;

  try {
    const response = await request<CollectResponseApi>(
      `/collect${buildAnalysisQuery(target)}`,
      {
        method: "POST",
        timeoutMs: COLLECT_TIMEOUT_MS,
        step: "collect",
        includeApiKey: false,
        authMode: "required",
      }
    );

    return withDataSource(response, "api");
  } catch (error) {
    if (!ENABLE_MOCK_FALLBACK || !shouldUseFinanceMockFallback(error)) {
      throw error;
    }

    return withDataSource(
      {
        ...mockCollectStartedApi,
        resolved_code: pickMockSummary(trimmedKeyword, target.stockCode)
          .stock_code,
      },
      "mock"
    );
  }
}

export async function getCollectionStatus(
  requestTarget: CompanyAnalysisRequest
): Promise<CollectionStatusResponseApi> {
  const target = normalizeAnalysisTarget(requestTarget);

  return request<CollectionStatusResponseApi>(
    `/collect/status${buildAnalysisQuery(target)}`,
    {
      timeoutMs: COLLECT_TIMEOUT_MS,
      step: "collect",
      includeApiKey: false,
      authMode: "required",
    }
  );
}

export async function getSummary(
  requestTarget: CompanyAnalysisRequest,
  unit?: string
): Promise<CompanySummaryApiResponse> {
  const target = normalizeAnalysisTarget(requestTarget);
  const trimmedKeyword = target.keyword;

  try {
    const rawResponse = await request<unknown>(
      `/summary${buildAnalysisQuery(target, { unit })}`,
      {
        timeoutMs: SUMMARY_TIMEOUT_MS,
        step: "summary",
        includeApiKey: false,
        authMode: "required",
      }
    );
    const response = normalizeCompanySummaryResponse(rawResponse, trimmedKeyword);
    const isPartial =
      !response.summary_text.trim() || response.history.length === 0;

    return withDataSource(response, isPartial ? "api-partial" : "api");
  } catch (error) {
    if (ENABLE_MOCK_FALLBACK && shouldUseFinanceMockFallback(error)) {
      return withDataSource(
        pickMockSummary(trimmedKeyword, target.stockCode),
        "mock"
      );
    }

    throw error;
  }
}

export async function getSummaryDetail(
  requestTarget: CompanyAnalysisRequest,
  unit = "원"
): Promise<SummaryDetailApiResponse> {
  const target = normalizeAnalysisTarget(requestTarget);
  const detailTarget = {
    ...target,
    keyword: target.stockCode ?? target.keyword,
  };
  const trimmedKeyword = target.keyword;

  try {
    const rawResponse = await request<SummaryDetailApiResponse>(
      `/summary/detail${buildAnalysisQuery(detailTarget, { unit })}`,
      {
        timeoutMs: SUMMARY_TIMEOUT_MS,
        step: "summary",
        includeApiKey: false,
        authMode: "required",
      }
    );
    const summary = normalizeCompanySummaryResponse(
      {
        ...rawResponse.summary,
        is_financial_sector:
          rawResponse.is_financial_sector === undefined
            ? rawResponse.summary.is_financial_sector
            : rawResponse.is_financial_sector,
        industry_type:
          rawResponse.industry_type === undefined
            ? rawResponse.summary.industry_type
            : rawResponse.industry_type,
        revenue_label:
          rawResponse.revenue_label === undefined
            ? rawResponse.summary.revenue_label
            : rawResponse.revenue_label,
        operating_profit_label:
          rawResponse.operating_profit_label === undefined
            ? rawResponse.summary.operating_profit_label
            : rawResponse.operating_profit_label,
      },
      trimmedKeyword
    );
    const normalizedTrendHistory = Array.isArray(rawResponse.trend?.history)
      ? rawResponse.trend.history
          .map(normalizeYearlyFinancialData)
          .filter((item) => item !== null)
      : [];
    const trend =
      rawResponse.trend && normalizedTrendHistory.length > 0
        ? {
            ...rawResponse.trend,
            history: sortFinancialHistory(normalizedTrendHistory),
          }
        : rawResponse.trend;

    return withDataSource(
      {
        ...rawResponse,
        summary,
        trend,
      },
      "api"
    );
  } catch (error) {
    if (ENABLE_MOCK_FALLBACK && shouldUseFinanceMockFallback(error)) {
      const summary = pickMockSummary(trimmedKeyword, target.stockCode);

      return withDataSource(
        {
          summary,
          trend: {
            company_name: summary.company_name,
            stock_code: summary.stock_code,
            fiscal_year: summary.fiscal_year,
            history: summary.history.map((item) => ({ ...item })),
          },
          collection_status: "completed",
          collection_updated_at: new Date().toISOString(),
        },
        "mock"
      );
    }

    throw error;
  }
}

export async function getAiAnalysis(
  keyword: string
): Promise<AiAnalysisResponse> {
  const trimmedKeyword = trimKeyword(keyword);
  const encodedKeyword = encodeURIComponent(trimmedKeyword);

  const response = await request<AiAnalysisResponse>(
    `/summary/ai-analysis?keyword=${encodedKeyword}`,
    {
      timeoutMs: AI_ANALYSIS_TIMEOUT_MS,
      includeApiKey: false,
      authMode: "required",
    }
  );

  return normalizeAiAnalysisResponse(response, trimmedKeyword);
}

export type InsightInterpretationRequestInput = {
  stockCode: string;
  company: string;
  latestYear: string | number;
  insights: readonly FinancialInsight[];
};

function toFiniteEvidenceNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function toCanonicalChangeRate(value: unknown) {
  const finiteValue = toFiniteEvidenceNumber(value);

  if (finiteValue === undefined) return undefined;

  const magnitude = Math.abs(finiteValue);
  const roundedMagnitude =
    Math.round(
      (magnitude + Number.EPSILON * Math.max(1, magnitude)) * 100
    ) / 100;

  return finiteValue < 0 ? -roundedMagnitude : roundedMagnitude;
}

function mapInsightFlag(
  insight: FinancialInsight
): InsightInterpretationFlagApi {
  const evidence = Array.isArray(insight.evidence) ? insight.evidence : [];

  return {
    id: insight.id,
    year: insight.year,
    title: insight.title,
    evidence: evidence.flatMap((item) => {
      if (!item || typeof item.label !== "string") return [];

      const currentValue = toFiniteEvidenceNumber(item.currentValue);

      if (currentValue === undefined) return [];

      const previousValue = toFiniteEvidenceNumber(item.previousValue);
      const changeRate = toCanonicalChangeRate(item.changeRate);

      return [
        {
          label: item.label,
          currentValue,
          ...(item.previousValue === null
            ? { previousValue: null }
            : previousValue === undefined
              ? {}
              : { previousValue }),
          ...(item.changeRate === null
            ? { changeRate: null }
            : changeRate === undefined
              ? {}
              : { changeRate }),
        },
      ];
    }),
  };
}

export function mapFinancialInsightsToInterpretationFlags(
  insights: readonly FinancialInsight[]
): Pick<
  InsightInterpretationRequestApi,
  "warning_flags" | "positive_flags"
> {
  const seenIds = new Set<string>();
  const warningFlags: InsightInterpretationFlagApi[] = [];
  const positiveFlags: InsightInterpretationFlagApi[] = [];

  insights.forEach((insight) => {
    if (seenIds.has(insight.id)) {
      return;
    }

    seenIds.add(insight.id);
    const flag = mapInsightFlag(insight);

    if (insight.type === "warning") {
      warningFlags.push(flag);
    } else {
      positiveFlags.push(flag);
    }
  });

  return {
    warning_flags: warningFlags,
    positive_flags: positiveFlags,
  };
}

export function buildInsightInterpretationRequest({
  stockCode,
  company,
  latestYear,
  insights,
}: InsightInterpretationRequestInput): InsightInterpretationRequestApi {
  return {
    stock_code: stockCode,
    company,
    latest_year: latestYear,
    ...mapFinancialInsightsToInterpretationFlags(insights),
  };
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

export function getInsightInterpretationRequestKey(
  input: InsightInterpretationRequestInput
): string | null {
  const payload = buildInsightInterpretationRequest(input);

  if (
    payload.warning_flags.length === 0 &&
    payload.positive_flags.length === 0
  ) {
    return null;
  }

  const toKeyFlag = (flag: InsightInterpretationFlagApi) => ({
    id: flag.id,
    evidence: flag.evidence
      .map((item) => ({ ...item }))
      .sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b))),
  });

  return stableSerialize({
    stock_code: payload.stock_code.trim(),
    latest_year: String(payload.latest_year),
    warning_flags: payload.warning_flags.map(toKeyFlag),
    positive_flags: payload.positive_flags.map(toKeyFlag),
  });
}

function normalizeInsightInterpretationResponse(
  response: unknown,
  fallbackStockCode: string
): InsightInterpretationResponseApi {
  if (!isRecord(response)) {
    throw new ApiParseError("api", JSON.stringify(response));
  }

  const stockCode =
    typeof response.stock_code === "string" && response.stock_code.trim()
      ? response.stock_code.trim()
      : fallbackStockCode;
  const interpretationAvailable = response.interpretation_available === true;

  if (!interpretationAvailable || !isRecord(response.interpretation)) {
    return {
      stock_code: stockCode,
      interpretation: null,
      interpretation_available: interpretationAvailable,
    };
  }

  const interpretation = response.interpretation;

  return {
    stock_code: stockCode,
    interpretation: {
      headline:
        typeof interpretation.headline === "string"
          ? interpretation.headline
          : "",
      positive:
        typeof interpretation.positive === "string"
          ? interpretation.positive
          : null,
      caution:
        typeof interpretation.caution === "string"
          ? interpretation.caution
          : null,
      check_items: Array.isArray(interpretation.check_items)
        ? interpretation.check_items.filter(
            (item): item is string => typeof item === "string"
          )
        : [],
    },
    interpretation_available: true,
  };
}

export async function interpretFinancialInsights(
  input: InsightInterpretationRequestInput
): Promise<InsightInterpretationResponseApi | null> {
  const payload = buildInsightInterpretationRequest(input);

  if (
    payload.warning_flags.length === 0 &&
    payload.positive_flags.length === 0
  ) {
    return null;
  }

  const response = await authorizedApiRequest<unknown>(
    "/finance/insights/interpret",
    {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: AI_ANALYSIS_TIMEOUT_MS,
    }
  );

  return normalizeInsightInterpretationResponse(response, payload.stock_code);
}

export type FinancialDisclosuresRequestInput = {
  stockCode: string;
  insights: readonly FinancialInsight[];
};

export function selectDisclosureRuleId(
  insights: readonly FinancialInsight[]
): string | null {
  const selectedInsight =
    insights.find((insight) => insight.type === "warning") ??
    insights.find((insight) => insight.type === "positive");

  return selectedInsight?.id ?? null;
}

export async function getFinancialDisclosures({
  stockCode,
  insights,
}: FinancialDisclosuresRequestInput): Promise<FinancialDisclosuresResponseApi | null> {
  const ruleId = selectDisclosureRuleId(insights);

  if (!ruleId) return null;

  const normalizedStockCode = stockCode.trim();

  if (!/^\d{6}$/.test(normalizedStockCode)) {
    throw new Error("stockCode must be a 6-digit stock code.");
  }

  return authorizedApiRequest<FinancialDisclosuresResponseApi>(
    `/finance/disclosures${buildQuery({
      stock_code: normalizedStockCode,
      rule_id: ruleId,
    })}`
  );
}

export async function getWatchlistSummaries(): Promise<WatchlistSummariesResponseApi> {
  const response = await authorizedApiRequest<
    WatchlistSummariesResponseApi | WatchlistSummaryItemApi[]
  >(
    "/users/me/watchlist/summaries"
  );

  return normalizeWatchlistSummariesResponse(response);
}

function normalizeWatchlistSummariesResponse(
  response: WatchlistSummariesResponseApi | WatchlistSummaryItemApi[]
): WatchlistSummariesResponseApi {
  if (Array.isArray(response)) {
    return { items: response };
  }

  return {
    ...response,
    items: Array.isArray(response.items) ? response.items : [],
  };
}

function trimMemo(memo?: string | null) {
  const nextMemo = memo?.trim() ?? "";

  if (nextMemo.length > 500) {
    throw createHttpError("메모는 500자 이내로 입력해 주세요.", 422);
  }

  return nextMemo || null;
}

export async function addWatchlistItem(
  stockCode: string,
  companyName: string,
  memo?: string | null
): Promise<WatchlistPostResponseApi> {
  const payload: WatchlistCreateRequestApi = {
    stock_code: stockCode,
    company_name: companyName,
    memo: trimMemo(memo),
  };

  return authorizedApiRequest<WatchlistPostResponseApi>("/users/me/watchlist", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function updateWatchlistItem(
  stockCode: string,
  payload: WatchlistUpdateRequestApi
): Promise<WatchlistMutationResponseApi> {
  return authorizedApiRequest<WatchlistMutationResponseApi>(
    `/users/me/watchlist/${encodeURIComponent(stockCode)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...payload,
        memo: trimMemo(payload.memo),
      }),
    }
  );
}

export async function updateWatchlistMemo(
  stockCode: string,
  memo: string
): Promise<WatchlistMutationResponseApi> {
  return updateWatchlistItem(stockCode, { memo });
}

export async function removeWatchlistItem(stockCode: string): Promise<void> {
  return authorizedApiRequest<void>(
    `/users/me/watchlist/${encodeURIComponent(stockCode)}`,
    {
      method: "DELETE",
      allowEmptyResponse: true,
    }
  );
}

export async function getDashboard(): Promise<DashboardResponseApi> {
  return authorizedApiRequest<DashboardResponseApi>("/users/me/dashboard");
}

async function saveCompareShare(
  keywords: string[],
  unit = "원"
): Promise<CompareShareSaveResponseApi> {
  return request<CompareShareSaveResponseApi>(
    `/compare/save${buildRepeatedQuery("keywords", keywords, { unit })}`,
    {
      method: "POST",
      includeApiKey: false,
      authMode: "required",
    }
  );
}

export async function createCompareShareLink(
  keywords: string[],
  unit = "원"
): Promise<CompareShareSaveResponseApi> {
  return saveCompareShare(keywords, unit);
}

export async function getCompareShare(
  shareId: string
): Promise<CompareShareResponseApi> {
  return request<CompareShareResponseApi>(
    `/compare/${encodeURIComponent(shareId)}`,
    {
      includeApiKey: false,
      authMode: "none",
    }
  );
}

export async function getSimilarCompanies(
  keyword: string,
  limit?: number
): Promise<SimilarCompanyApi[]> {
  const response = await request<SimilarCompaniesResponseApi>(
    `/similar${buildQuery({ keyword: trimKeyword(keyword), limit })}`,
    {
      includeApiKey: false,
      authMode: "required",
    }
  );

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.items)) {
    return response.items;
  }

  if (Array.isArray(response.similar_companies)) {
    return response.similar_companies;
  }

  if (Array.isArray(response.results)) {
    return response.results;
  }

  return [];
}

export async function getRecommendedCompanies(
  limit = 5
): Promise<RecommendedCompanyApi[]> {
  return request<RecommendedCompanyApi[]>(
    `/recommendation${buildQuery({ limit })}`,
    {
      includeApiKey: false,
      authMode: "required",
    }
  );
}

/**
 * 諛쒗몴???뺤옣 ?ъ씤??
 * ?꾩옱 ?곗꽑?쒖쐞?????留? 異뷀썑 ?멸린 寃??湲곗뾽 湲곕뒫??遺숈씪 ???ъ슜?????덉뒿?덈떎.
 */
export async function getPopularCompanies(params?: {
  limit?: number;
  window?: PopularCompaniesWindow;
}): Promise<PopularCompaniesResponseApi> {
  if (USE_MOCK_API) {
    const limit = params?.limit ?? 10;
    const window = params?.window ?? "realtime";

    return {
      items: mockSearchResultsApi.slice(0, limit).map((company, index) => ({
        keyword: company.name ?? company.code ?? `Mock ${index + 1}`,
        count: 100 - index * 10,
        rank: index + 1,
        updated_at: new Date().toISOString(),
      })),
      window,
      generated_at: new Date().toISOString(),
    };
  }

  const query = buildQuery({
    limit: params?.limit ?? 10,
    window: params?.window ?? "realtime",
  });

  return request<PopularCompaniesResponseApi>(`/search/popular${query}`, {
    includeApiKey: false,
    authMode: "required",
  });
}

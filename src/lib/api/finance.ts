import type {
  ApiDataSourceMeta,
  AiAnalysisResponse,
  CollectResponseApi,
  CollectionStatusResponseApi,
  CompanySummaryApiResponse,
  SummaryDetailApiResponse,
} from "@/types/api";
import type { CompanyAnalysisTarget } from "@/lib/companySearch";
import {
  mockCollectStartedApi,
  mockFinancialSummaryApiResponse,
  mockKnownCompaniesApi,
  mockSummaryApiResponse,
} from "@/mock/api";
import {
  ENABLE_MOCK_FALLBACK,
  readPositiveNumberEnv,
} from "@/lib/apiConfig";
import {
  getApiErrorCode,
  getApiErrorStatus,
  getFinanceServiceUnavailableKind,
} from "@/lib/apiErrors";
import { request } from "@/lib/api/client";
import {
  normalizeCompanySummaryResponse,
  normalizeYearlyFinancialData,
  sortFinancialHistory,
} from "@/lib/financialNormalize";

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

type QueryValue = string | number | boolean | null | undefined;
type CompanyAnalysisRequest = string | CompanyAnalysisTarget;

function trimKeyword(keyword: string): string {
  return keyword.trim();
}

function normalizeMockCompanyKey(value: string) {
  return trimKeyword(value).replace(/\s+/g, "").toLowerCase();
}

function normalizeAnalysisTarget(
  requestTarget: CompanyAnalysisRequest
): CompanyAnalysisTarget {
  if (typeof requestTarget === "string") {
    const keyword = trimKeyword(requestTarget);
    return {
      keyword,
      displayName: keyword,
    };
  }

  const keyword = trimKeyword(requestTarget.keyword);

  return {
    keyword,
    corpCode: requestTarget.corpCode?.trim() || undefined,
    stockCode: requestTarget.stockCode?.trim() || undefined,
    displayName: requestTarget.displayName?.trim() || keyword,
  };
}

function buildAnalysisQuery(
  target: CompanyAnalysisTarget,
  extra?: Record<string, QueryValue>
) {
  const searchParams = new URLSearchParams();

  Object.entries({
    keyword: target.keyword,
    corpCode: target.corpCode,
    stockCode: target.stockCode,
    ...extra,
  }).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
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

function shouldUseFinanceMockFallback(error: unknown) {
  const status = getApiErrorStatus(error);

  if (status === 401 || status === 403 || getApiErrorCode(error)) {
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
      authMode: "required",
    }
  );

  return normalizeAiAnalysisResponse(response, trimmedKeyword);
}

import {
  getApiErrorStatus,
  getInsightInterpretationRequestKey,
  interpretFinancialInsights,
  type InsightInterpretationRequestInput,
} from "@/lib/api";
import type { FinancialInsight } from "@/lib/financialInsights";
import type {
  InsightInterpretationApi,
  InsightInterpretationResponseApi,
} from "@/types/api";
import type { AsyncSectionStatus } from "@/types/asyncSection";

export type InsightInterpretationViewState = {
  status: Exclude<AsyncSectionStatus, "empty">;
  interpretation: InsightInterpretationApi | null;
  errorText: string;
};

export type InsightInterpretationCacheEntry = {
  promise: Promise<InsightInterpretationViewState>;
  result?: InsightInterpretationViewState;
};

export type InsightInterpretationCache = Map<
  string,
  InsightInterpretationCacheEntry
>;

export type InsightInterpretationFlowInput = {
  enabled: boolean;
  isFinancialSector: boolean;
  stockCode?: string | null;
  company?: string | null;
  latestYear?: string | number | null;
  insights: readonly FinancialInsight[];
};

type InterpretFinancialInsights = (
  input: InsightInterpretationRequestInput
) => Promise<InsightInterpretationResponseApi | null>;

export type InsightInterpretationFlowEntry = {
  requestKey: string;
  cacheEntry: InsightInterpretationCacheEntry;
};

export function createIdleInsightInterpretationState(): InsightInterpretationViewState {
  return {
    status: "idle",
    interpretation: null,
    errorText: "",
  };
}

function getInsightInterpretationErrorMessage(error: unknown) {
  const status = getApiErrorStatus(error);

  switch (status) {
    case 400:
      return "AI 해석 요청 형식이 올바르지 않습니다.";
    case 401:
      return "로그인 상태를 확인해 주세요.";
    case 422:
      return "AI 해석에 필요한 신호 데이터가 올바르지 않습니다.";
    case 429:
      return "AI 해석 요청이 많아 현재 결과를 불러오지 못했습니다. 잠시 후 페이지를 다시 열어 주세요.";
    default:
      return error instanceof TypeError
        ? "네트워크 연결을 확인한 뒤 다시 시도해 주세요."
        : "AI 해석을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
  }
}

function toViewState(
  response: InsightInterpretationResponseApi | null
): InsightInterpretationViewState {
  if (
    !response ||
    !response.interpretation_available ||
    !response.interpretation
  ) {
    return {
      status: "fallback",
      interpretation: null,
      errorText: "",
    };
  }

  return {
    status: "success",
    interpretation: response.interpretation,
    errorText: "",
  };
}

function buildFlowRequest(
  input: InsightInterpretationFlowInput
): { requestKey: string; requestInput: InsightInterpretationRequestInput } | null {
  if (!input.enabled || input.isFinancialSector) return null;

  const stockCode = input.stockCode?.trim() ?? "";
  const company = input.company?.trim() ?? "";

  if (!stockCode || !company || !input.latestYear) return null;

  const requestInput: InsightInterpretationRequestInput = {
    stockCode,
    company,
    latestYear: input.latestYear,
    insights: input.insights,
  };
  const requestKey = getInsightInterpretationRequestKey(requestInput);

  return requestKey ? { requestKey, requestInput } : null;
}

export function getInsightInterpretationFlowEntry(
  input: InsightInterpretationFlowInput,
  cache: InsightInterpretationCache,
  interpret: InterpretFinancialInsights = interpretFinancialInsights
): InsightInterpretationFlowEntry | null {
  const request = buildFlowRequest(input);

  if (!request) return null;

  const { requestKey, requestInput } = request;
  let cacheEntry = cache.get(requestKey);

  if (!cacheEntry) {
    const promise = interpret(requestInput)
      .then(toViewState)
      .catch<InsightInterpretationViewState>((error) => ({
        status: "error",
        interpretation: null,
        errorText: getInsightInterpretationErrorMessage(error),
      }));

    cacheEntry = { promise };
    cache.set(requestKey, cacheEntry);

    void promise.then((result) => {
      const currentEntry = cache.get(requestKey);

      if (currentEntry?.promise === promise) {
        currentEntry.result = result;
      }
    });
  }

  return { requestKey, cacheEntry };
}

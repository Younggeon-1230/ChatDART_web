import { ENABLE_AI_ANALYSIS } from "@/lib/apiConfig";
import {
  getApiErrorCode,
  getApiErrorMessage,
  getApiErrorStatus,
  getFinanceServiceUnavailableKind,
  isRateLimitError,
} from "@/lib/apiErrors";
import { ApiParseError } from "@/lib/api/client";

export {
  login,
  logout,
  logoutCurrentUser,
  refreshToken,
  register,
} from "@/lib/api/auth";
export { refreshStoredAuthTokens } from "@/lib/api/client";
export {
  addWatchlistItem,
  getDashboard,
  getMembershipPlans,
  getMyMembership,
  getWatchlistSummaries,
  removeWatchlistItem,
  updateWatchlistMemo,
} from "@/lib/api/account";
export {
  AI_ANALYSIS_TIMEOUT_MS,
  COLLECT_TIMEOUT_MS,
  SUMMARY_TIMEOUT_MS,
  getAiAnalysis,
  getAiAnalysisErrorMessage,
  getCollectionStatus,
  getSummary,
  getSummaryDetail,
  startCollection,
} from "@/lib/api/finance";
export {
  buildInsightInterpretationRequest,
  getFinancialDisclosures,
  getInsightInterpretationRequestKey,
  interpretFinancialInsights,
  mapFinancialInsightsToInterpretationFlags,
  selectDisclosureRuleId,
} from "@/lib/api/insights";
export type {
  FinancialDisclosuresRequestInput,
  InsightInterpretationRequestInput,
} from "@/lib/api/insights";
export {
  createCompareShareLink,
  getCompareShare,
} from "@/lib/api/compare";
export {
  getPopularCompanies,
  getRecommendedCompanies,
  getSimilarCompanies,
} from "@/lib/api/discovery";

export function getUserFriendlyApiErrorMessage(
  error: unknown,
  fallback = "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
) {
  if (error instanceof ApiParseError) {
    return "응답 형식이 올바르지 않아 데이터를 표시하지 못했습니다.";
  }

  return getApiErrorMessage(error, fallback);
}

export { getApiErrorCode, getApiErrorStatus, isRateLimitError };
export { getFinanceServiceUnavailableKind };
export { ENABLE_AI_ANALYSIS };

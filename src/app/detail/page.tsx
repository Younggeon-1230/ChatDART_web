"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileBarChart2 } from "lucide-react";
import { StatusBadge } from "@/components/common/Badge";
import { InnerSurface, SectionCard, TableFrame } from "@/components/common/Card";
import ScrollTopButton from "@/components/common/ScrollTopButton";
import { StatusState } from "@/components/common/StatusState";
import PageFrame from "@/components/financial/PageFrame";
import AiReportSlot, {
  type AiReportStatus,
} from "@/components/financial/AiReportSlot";
import AiInsightInterpretationSection, {
  type AiInsightInterpretationStatus,
} from "@/components/financial/AiInsightInterpretationSection";
import Box from "@/components/financial/Box";
import CostCompositionChart from "@/components/financial/CostCompositionChart";
import CostFlowChart from "@/components/financial/CostFlowChart";
import FinancialInsightsSection from "@/components/financial/FinancialInsightsSection";
import PostOperatingProfitFlow from "@/components/financial/PostOperatingProfitFlow";
import ProfitQualitySection from "@/components/financial/ProfitQualitySection";
import RelatedDisclosuresSection, {
  type RelatedDisclosuresStatus,
} from "@/components/financial/RelatedDisclosuresSection";
import SectorComparisonSection from "@/components/financial/SectorComparisonSection";
import SectionLabel from "@/components/financial/SectionLabel";
import SimpleLineChart from "@/components/financial/LineChart";
import RelatedCompanyList from "@/components/financial/RelatedCompanyList";
import CompanySearchBar, {
  type CompanySearchResult,
} from "@/components/financial/CompanySearchBar";
import { useDataSource } from "@/components/layout/DataSourceProvider";
import { useMockAuth } from "@/hooks/useMockAuth";
import {
  ENABLE_AI_ANALYSIS,
  getAiAnalysis,
  getAiAnalysisErrorMessage,
  getApiErrorStatus,
  getFinanceServiceUnavailableKind,
  getFinancialDisclosures,
  getInsightInterpretationRequestKey,
  getSummaryDetail,
  getSimilarCompanies,
  getUserFriendlyApiErrorMessage,
  interpretFinancialInsights,
  selectDisclosureRuleId,
  startCollection,
} from "@/lib/api";
import { canUseFeature } from "@/lib/featureAccess";
import {
  getFinancialStatusChipClass,
  getFinancialStatusTextClass,
} from "@/lib/financialStatusStyle";
import {
  formatCurrency,
  formatNumber,
  formatPercent as formatPercentValue,
  formatSignedPercent,
  type NumericValue,
} from "@/lib/format";
import { addRecentCompany } from "@/lib/recentCompanies";
import {
  type CompanyAnalysisTarget,
  buildCompanyAnalysisUrl,
} from "@/lib/companySearch";
import { probeDetailCollectionState } from "@/lib/detailCollectionFlow";
import {
  buildSummaryTextCards,
  getInvestmentMetricDescription,
} from "@/lib/financialNarratives";
import {
  buildComprehensiveFinancialAnalysis,
  type ComprehensiveFinancialStatus,
} from "@/lib/financialTrendAnalysis";
import {
  calculateFinancialGrowth,
  calculateDebtRatio,
  calculateEquityRatio,
  calculateROA,
  calculateROE,
  getFinancialMetricSeries,
  getFinancialValues,
  getFiscalYearNumber,
  pickLatestFinancialYears,
  resolveFinancialSector,
} from "@/lib/financialNormalize";
import { STATUS_MESSAGES } from "@/lib/statusMessages";
import {
  analyzeFinancialInsights,
  isProfitQualityInsight,
} from "@/lib/financialInsights";
import { buildSectorComparisonItems } from "@/lib/sectorComparison";
import type {
  AiAnalysisResponse,
  CompanySummaryApiResponse,
  FinancialDisclosureApi,
  InsightInterpretationApi,
  SimilarCompanyApi,
  YearlyDataApi,
} from "@/types/api";

type PageState =
  | "idle"
  | "collecting"
  | "polling"
  | "fetching"
  | "completed"
  | "timeout"
  | "error";

type AiReportViewState = {
  status: AiReportStatus;
  analysis: AiAnalysisResponse | null;
  errorText: string;
};

type AiInsightInterpretationViewState = {
  status: AiInsightInterpretationStatus;
  interpretation: InsightInterpretationApi | null;
  errorText: string;
};

type RelatedDisclosuresViewState = {
  status: RelatedDisclosuresStatus;
  disclosures: FinancialDisclosureApi[];
  errorText: string;
};

type AsyncSectionCacheEntry<T> = {
  promise: Promise<T>;
  result?: T;
};

type MiniChartConfig = {
  title: string;
  labels?: string[];
  values: Array<number | null>;
  formatter: (value: NumericValue) => string;
  note?: string;
  highlightProfitLoss?: boolean;
};

type DetailMetricCard = {
  label: string;
  value: string;
  description: string;
  valueClassName?: string;
};

type ReferenceRating = "우수" | "양호" | "보통" | "주의" | "정보 부족";
type SimilarCompaniesStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error";

type MetricFact = {
  label: string;
  value: string;
};

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

function getRelatedDisclosuresErrorMessage(error: unknown) {
  const status = getApiErrorStatus(error);

  if (status === 401) return "로그인 상태를 확인해 주세요.";
  if (status === 429) return "요청이 많아 관련 공시를 불러오지 못했습니다.";

  return error instanceof TypeError
    ? "네트워크 연결을 확인하고 다시 시도해 주세요."
    : "관련 공시를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
}

function createIdleAiInsightInterpretationState(): AiInsightInterpretationViewState {
  return {
    status: "idle",
    interpretation: null,
    errorText: "",
  };
}

function createIdleRelatedDisclosuresState(): RelatedDisclosuresViewState {
  return {
    status: "idle",
    disclosures: [],
    errorText: "",
  };
}

type MetricInsightCardProps = {
  title: string;
  grade?: string;
  value?: string;
  description: string;
  facts?: MetricFact[];
  criteria?: string;
};

const POLLING_INTERVAL_MS = 1500;
const MAX_STATUS_CHECK_COUNT = 40;
const POLLING_TIMEOUT_MESSAGE =
  "아직 수집이 완료되지 않았습니다. 시간이 오래 걸리면 잠시 후 다시 검색하거나 새로고침해 주세요.";
const PROCESSING_STATUS_MESSAGE =
  "해당 기업의 재무 데이터를 준비하고 있습니다. 완료되면 자동으로 다시 불러옵니다.";
const CHART_GRID_CLASSNAME = "grid grid-cols-1 gap-4 md:grid-cols-2";
const DETAIL_SURFACE_CLASSNAME =
  "rounded-lg border border-sky-100 bg-sky-50/70 px-4 py-4";
const DETAIL_CHART_CARD_CLASSNAME =
  "min-h-[420px] min-w-0 max-w-full rounded-lg border border-sky-100 bg-gradient-to-br from-white to-sky-50 p-4 shadow-sm shadow-sky-100/50 sm:p-5";

function getComprehensiveStatusClassName(
  status: ComprehensiveFinancialStatus
) {
  switch (status) {
    case "recovering":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "improving":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "deteriorating":
      return "border-red-200 bg-red-50 text-red-700";
    case "mixed":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "stable":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-white text-slate-500";
  }
}

function waitForPollingInterval() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, POLLING_INTERVAL_MS);
  });
}

function toEokUnit(value: NumericValue) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  if (Math.abs(value) >= 100_000_000) {
    return value / 100_000_000;
  }

  return value;
}

function formatEok(value: NumericValue) {
  const eokValue = toEokUnit(value);

  if (eokValue === null) {
    return "-";
  }

  const sign = eokValue < 0 ? "-" : "";
  const abs = Math.abs(eokValue);

  if (abs >= 10000) {
    const jo = Math.floor(abs / 10000);
    const eokRemainder = Math.round(abs % 10000);
    return eokRemainder > 0
      ? `${sign}${formatNumber(jo)}조 ${formatCurrency(eokRemainder, "억")}`
      : `${sign}${formatNumber(jo)}조`;
  }

  return `${sign}${formatCurrency(Math.round(abs), "억")}`;
}

function formatPercent(value: NumericValue) {
  return formatPercentValue(value, 1);
}

function getLatestValue<T>(items: T[]) {
  return items.length > 0 ? items[items.length - 1] : null;
}

function getOptionalString(
  source: unknown,
  keys: string[]
): string | null {
  if (!source || typeof source !== "object") {
    return null;
  }

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value)) {
      const joined = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .join(", ");

      if (joined) {
        return joined;
      }
    }
  }

  return null;
}

function getNonEmptyText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getSimilarCompanyName(company: SimilarCompanyApi) {
  return (
    getNonEmptyText(company.company_name) ||
    getOptionalString(company, [
      "corp_name",
      "corpName",
      "companyName",
      "name",
    ]) ||
    "기업명 없음"
  );
}

function getSimilarCompanyStockCode(company: SimilarCompanyApi) {
  return getNonEmptyText(company.stock_code);
}

function getSimilarCompanyReason(company: SimilarCompanyApi) {
  const reasons = company.reasons;
  const normalizedReasons = Array.isArray(reasons)
    ? reasons
        .map((item) => getNonEmptyText(item))
        .filter(Boolean)
        .join(" · ")
    : getNonEmptyText(reasons);

  return (
    getNonEmptyText(company.similarity_reason) ||
    getNonEmptyText(company.reason) ||
    normalizedReasons ||
    [company.growth_status, company.stability_status, company.profitability_status]
      .filter((value): value is string => typeof value === "string" && !!value.trim())
      .join(" · ")
  );
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getSectorAverageSampleSize(
  summary: CompanySummaryApiResponse | null
) {
  const value = summary?.sector_avg?.sample_size;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function pickLatestAnalysisYears(history: YearlyDataApi[]) {
  return pickLatestFinancialYears(history, 5);
}

function parseYear(value: string | number | null | undefined) {
  return getFiscalYearNumber(value);
}

function getValues(
  history: YearlyDataApi[],
  key: keyof YearlyDataApi
) {
  return getFinancialValues(history, key);
}

function calculateGrowthRate(
  current: number | null | undefined,
  previous: number | null | undefined
) {
  return calculateFinancialGrowth(current, previous, { allowNegative: true });
}

function getRatioSeries(
  history: YearlyDataApi[],
  fullHistory: YearlyDataApi[],
  key: "operating_margin" | "net_margin" | "revenue_growth_rate"
) {
  return getFinancialMetricSeries(history, fullHistory, key);
}

function getDebtRatio(item: YearlyDataApi | null) {
  return calculateDebtRatio(item);
}

function getEquityRatio(item: YearlyDataApi | null) {
  return calculateEquityRatio(item);
}

function getRoe(item: YearlyDataApi | null) {
  return calculateROE(item);
}

function getRoa(item: YearlyDataApi | null) {
  return calculateROA(item);
}

function getRoeRating(roe: number | null | undefined): ReferenceRating {
  if (roe == null) return "정보 부족";

  // Conservative reference thresholds; all percentage inputs are percent units.
  if (roe >= 20) return "우수";
  if (roe >= 10) return "양호";
  if (roe > 0) return "보통";
  return "주의";
}

function getProfitPowerRating(
  operatingMargin: number | null | undefined,
  netMargin: number | null | undefined
): ReferenceRating {
  if (operatingMargin == null || netMargin == null) return "정보 부족";

  // Conservative reference thresholds; all percentage inputs are percent units.
  if (operatingMargin >= 10 && netMargin >= 8) return "우수";
  if (operatingMargin >= 5 && netMargin >= 3) return "양호";
  if (operatingMargin > 0 && netMargin > 0) return "보통";
  return "주의";
}

function getFinancialCapacityRating(
  debtRatio: number | null | undefined,
  equityRatio: number | null | undefined,
  cash: number | null | undefined
): ReferenceRating {
  if (debtRatio == null && equityRatio == null && cash == null) {
    return "정보 부족";
  }

  // Conservative reference thresholds; all percentage inputs are percent units.
  if ((debtRatio ?? Infinity) <= 100 && (equityRatio ?? 0) >= 50) {
    return "우수";
  }

  if ((debtRatio ?? Infinity) <= 200 && (equityRatio ?? 0) >= 30) {
    return "양호";
  }

  if ((debtRatio ?? Infinity) <= 300) return "보통";
  return "주의";
}

function getGrowthMomentumRating(
  revenueGrowthRate: number | null | undefined,
  operatingIncomeGrowthRate: number | null | undefined
): ReferenceRating {
  if (revenueGrowthRate == null && operatingIncomeGrowthRate == null) {
    return "정보 부족";
  }

  // Conservative reference thresholds; all percentage inputs are percent units.
  if ((revenueGrowthRate ?? 0) >= 10 && (operatingIncomeGrowthRate ?? 0) >= 10) {
    return "우수";
  }

  if ((revenueGrowthRate ?? 0) > 0 && (operatingIncomeGrowthRate ?? 0) > 0) {
    return "양호";
  }

  if ((revenueGrowthRate ?? 0) > 0 || (operatingIncomeGrowthRate ?? 0) > 0) {
    return "보통";
  }

  return "주의";
}

function MetricInsightCard({
  title,
  grade,
  value,
  description,
  facts = [],
  criteria,
}: MetricInsightCardProps) {
  return (
    <SectionCard className="bg-white/70 px-4 py-4">
      <p className="text-xs font-medium text-slate-500">{title}</p>

      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <strong
          className={`text-2xl font-bold ${getFinancialStatusTextClass(
            grade ?? value
          )}`}
        >
          {value ?? grade ?? "정보 부족"}
        </strong>
        {value && grade && (
          <span
            className={`inline-flex max-w-full items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${getFinancialStatusChipClass(
              grade
            )}`}
          >
            {grade}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {description}
      </p>

      {facts.length > 0 && (
        <dl className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-xs">
          {facts.map((fact) => (
            <div key={fact.label} className="flex justify-between gap-3">
              <dt className="text-slate-500">{fact.label}</dt>
              <dd className="text-right font-semibold text-slate-900">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {criteria && (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          기준: {criteria}
        </p>
      )}
    </SectionCard>
  );
}

function FeatureLockedCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Box className="p-6">
      <SectionLabel>{title}</SectionLabel>
      <InnerSurface className="px-4 py-5 text-sm leading-7 text-slate-600">
        {description}
      </InnerSurface>
    </Box>
  );
}

function DetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const keyword = searchParams.get("keyword")?.trim() ?? "";
  const corpCode = searchParams.get("corpCode")?.trim() || undefined;
  const stockCode = searchParams.get("stockCode")?.trim() || undefined;
  const displayName = searchParams.get("displayName")?.trim() || undefined;
  const analysisTarget = useMemo<CompanyAnalysisTarget>(
    () => ({
      keyword,
      corpCode,
      stockCode,
      displayName,
    }),
    [corpCode, displayName, keyword, stockCode]
  );
  const { plan } = useMockAuth();
  const canAccessDetail = canUseFeature(plan, "detailAnalysis");

  const [pageState, setPageState] = useState<PageState>("idle");
  const [summaryData, setSummaryData] =
    useState<CompanySummaryApiResponse | null>(null);
  const [message, setMessage] = useState("기업을 검색해 주세요.");
  const [errorText, setErrorText] = useState("");
  const [aiReportState, setAiReportState] = useState<AiReportViewState>({
    status: "disabled",
    analysis: null,
    errorText: "",
  });
  const [aiInsightInterpretationState, setAiInsightInterpretationState] =
    useState<AiInsightInterpretationViewState>(
      createIdleAiInsightInterpretationState
    );
  const [relatedDisclosuresState, setRelatedDisclosuresState] =
    useState<RelatedDisclosuresViewState>(createIdleRelatedDisclosuresState);
  const [similarCompaniesStatus, setSimilarCompaniesStatus] =
    useState<SimilarCompaniesStatus>("idle");
  const [similarCompanies, setSimilarCompanies] = useState<SimilarCompanyApi[]>(
    []
  );
  const [similarCompaniesErrorText, setSimilarCompaniesErrorText] =
    useState("");
  const {
    setBackendStatus,
    setDataSource,
    setIsRunningAnalysis,
  } = useDataSource();

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isRequestingRef = useRef(false);
  const statusCheckCountRef = useRef(0);
  const activeRequestKeyRef = useRef("");
  const activeAiInsightRequestKeyRef = useRef<string | null>(null);
  const aiInsightRequestCacheRef = useRef(
    new Map<
      string,
      AsyncSectionCacheEntry<AiInsightInterpretationViewState>
    >()
  );
  const activeRelatedDisclosuresRequestKeyRef = useRef<string | null>(null);
  const relatedDisclosuresRequestCacheRef = useRef(
    new Map<string, AsyncSectionCacheEntry<RelatedDisclosuresViewState>>()
  );

  const resetAiInsightInterpretation = useCallback(() => {
    activeAiInsightRequestKeyRef.current = null;
    setAiInsightInterpretationState(createIdleAiInsightInterpretationState());
  }, []);

  const resetRelatedDisclosures = useCallback(() => {
    activeRelatedDisclosuresRequestKeyRef.current = null;
    setRelatedDisclosuresState(createIdleRelatedDisclosuresState());
  }, []);

  const resetInsightAsyncSections = useCallback(() => {
    resetAiInsightInterpretation();
    resetRelatedDisclosures();
  }, [resetAiInsightInterpretation, resetRelatedDisclosures]);

  const isLoading =
    !!keyword &&
    pageState !== "completed" &&
    pageState !== "idle" &&
    pageState !== "timeout" &&
    pageState !== "error";

  function clearPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    isRequestingRef.current = false;
    statusCheckCountRef.current = 0;
  }

  const applyError = useCallback((
    error: unknown,
    fallbackMessage = "분석 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
  ) => {
    const status = getApiErrorStatus(error);

    setPageState("error");
    setDataSource("none");
    setBackendStatus(status === 408 ? "timeout" : "failed");
    setIsRunningAnalysis(false);
    setErrorText(getUserFriendlyApiErrorMessage(error, fallbackMessage));
  }, [
    setBackendStatus,
    setDataSource,
    setIsRunningAnalysis,
  ]);

  useEffect(() => {
    return () => clearPolling();
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!ENABLE_AI_ANALYSIS || pageState !== "completed" || !summaryData) {
      setAiReportState({
        status: "disabled",
        analysis: null,
        errorText: "",
      });
      return;
    }

    const aiKeyword = summaryData.stock_code || keyword;

    async function loadAiReport() {
      try {
        setAiReportState({
          status: "loading",
          analysis: null,
          errorText: "",
        });

        const response = await getAiAnalysis(aiKeyword);

        if (!isMounted) return;

        setAiReportState({
          status: "success",
          analysis: response,
          errorText: "",
        });
      } catch (error) {
        if (!isMounted) return;

        setAiReportState({
          status: "error",
          analysis: null,
          errorText: getAiAnalysisErrorMessage(error),
        });
      }
    }

    void loadAiReport();

    return () => {
      isMounted = false;
    };
  }, [keyword, pageState, summaryData]);

  useEffect(() => {
    let isMounted = true;

    if (pageState !== "completed" || !summaryData) {
      setSimilarCompaniesStatus("idle");
      setSimilarCompanies([]);
      setSimilarCompaniesErrorText("");
      return;
    }

    const similarKeyword = summaryData.stock_code || stockCode || keyword;

    if (!similarKeyword) {
      setSimilarCompaniesStatus("idle");
      setSimilarCompanies([]);
      setSimilarCompaniesErrorText("");
      return;
    }

    async function loadSimilarCompanies() {
      try {
        setSimilarCompaniesStatus("loading");
        setSimilarCompanies([]);
        setSimilarCompaniesErrorText("");

        const response = await getSimilarCompanies(similarKeyword);

        if (!isMounted) return;

        const currentStockCode = summaryData?.stock_code;
        const filteredCompanies = response
          .filter((company) => {
            const stockCodeValue = getSimilarCompanyStockCode(company);
            return !currentStockCode || stockCodeValue !== currentStockCode;
          })
          .slice(0, 5);

        setSimilarCompanies(filteredCompanies);
        setSimilarCompaniesStatus(
          filteredCompanies.length > 0 ? "success" : "empty"
        );
      } catch (error) {
        if (!isMounted) return;

        setSimilarCompanies([]);
        setSimilarCompaniesStatus("error");
        setSimilarCompaniesErrorText(
          getUserFriendlyApiErrorMessage(
            error,
            "유사 기업 추천을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
          )
        );
      }
    }

    void loadSimilarCompanies();

    return () => {
      isMounted = false;
    };
  }, [keyword, pageState, stockCode, summaryData]);

  useEffect(() => {
    let isActive = true;
    const requestKey = JSON.stringify({
      keyword,
      corpCode,
      stockCode,
      displayName,
    });
    activeRequestKeyRef.current = requestKey;
    resetInsightAsyncSections();
    const isCurrentRequest = () =>
      isActive && activeRequestKeyRef.current === requestKey;

    if (!canAccessDetail) {
      activeRequestKeyRef.current = "";
      clearPolling();
      setPageState("idle");
      setSummaryData(null);
      setErrorText("");
      setMessage("상세 분석은 권한이 필요한 기능입니다.");
      setDataSource("none");
      setBackendStatus("idle");
      setIsRunningAnalysis(false);
      return;
    }

    if (!keyword) {
      activeRequestKeyRef.current = "";
      setPageState("idle");
      setSummaryData(null);
      setErrorText("");
      setMessage("기업을 검색해 주세요.");
      setDataSource("none");
      setBackendStatus("idle");
      setIsRunningAnalysis(false);
      clearPolling();
      return;
    }

    setSummaryData(null);
    setErrorText("");
    setMessage(`"${keyword}" 상세 분석 데이터를 확인하는 중입니다.`);
    let shouldRequestCollection = false;
    let hasRequestedCollection = false;

    async function loadIntegratedDetail() {
      const detailProbe = await probeDetailCollectionState(
        analysisTarget,
        getSummaryDetail
      );

      if (!isCurrentRequest()) return true;

      if (detailProbe.kind === "needs_collection") {
        shouldRequestCollection = !hasRequestedCollection;
        setPageState(hasRequestedCollection ? "polling" : "collecting");
        setBackendStatus("requesting");
        setMessage(
          hasRequestedCollection
            ? PROCESSING_STATUS_MESSAGE
            : "수집 이력이 없어 데이터 수집을 요청하는 중입니다."
        );
        return false;
      }

      const response = detailProbe.detail;

      if (response.collection_status === "completed") {
        shouldRequestCollection = false;
        clearPolling();

        if (response.__dataSource === "mock") {
          setDataSource("mock");
          setBackendStatus("fallback-mock");
        } else {
          setDataSource(response.__dataSource ?? "api");
          setBackendStatus("success");
        }

        setIsRunningAnalysis(false);
        addRecentCompany({
          name: response.summary.company_name,
          stockCode: response.summary.stock_code,
        });
        setSummaryData(response.summary);
        setPageState("completed");
        setMessage("상세 분석이 완료되었습니다.");
        return true;
      }

      if (response.collection_status === "failed") {
        shouldRequestCollection = false;
        clearPolling();
        setPageState("error");
        setErrorText(
          response.message ??
            "데이터 수집에 실패했습니다. 잠시 후 다시 시도해 주세요."
        );
        setDataSource("none");
        setBackendStatus("failed");
        setIsRunningAnalysis(false);
        return true;
      }

      if (statusCheckCountRef.current >= MAX_STATUS_CHECK_COUNT) {
        clearPolling();
        setPageState("timeout");
        setBackendStatus("timeout");
        setIsRunningAnalysis(false);
        setMessage(POLLING_TIMEOUT_MESSAGE);
        return true;
      }

      if (
        response.collection_status === "pending" ||
        response.collection_status === "processing"
      ) {
        shouldRequestCollection = false;
        setPageState("polling");
        setBackendStatus("requesting");
        setMessage(PROCESSING_STATUS_MESSAGE);
        return false;
      }

      if (response.collection_status && response.collection_status !== "none") {
        shouldRequestCollection = false;
        clearPolling();
        setPageState("timeout");
        setBackendStatus("timeout");
        setIsRunningAnalysis(false);
        setMessage(
          "수집 상태를 확인할 수 없습니다. 잠시 후 다시 검색하거나 새로고침해 주세요."
        );
        return true;
      }

      shouldRequestCollection = !hasRequestedCollection;
      setPageState(hasRequestedCollection ? "polling" : "collecting");
      setBackendStatus("requesting");
      setMessage(
        hasRequestedCollection
          ? PROCESSING_STATUS_MESSAGE
          : "수집 이력이 없어 데이터 수집을 요청하는 중입니다."
      );
      return false;
    }

    async function pollIntegratedDetail() {
      if (isRequestingRef.current || !isCurrentRequest()) return false;
      isRequestingRef.current = true;

      try {
        statusCheckCountRef.current += 1;
        return await loadIntegratedDetail();
      } catch (error) {
        if (!isCurrentRequest()) return true;
        if (
          getFinanceServiceUnavailableKind(error) === "loading" &&
          statusCheckCountRef.current < MAX_STATUS_CHECK_COUNT
        ) {
          setPageState("polling");
          setBackendStatus("requesting");
          setMessage(getUserFriendlyApiErrorMessage(error));
          return false;
        }

        clearPolling();
        applyError(error, "상세 분석 상태 확인 중 오류가 발생했습니다.");
        return true;
      } finally {
        isRequestingRef.current = false;
      }
    }

    async function loadIntegratedDetailWithLoadingRetry() {
      while (isCurrentRequest()) {
        try {
          return await loadIntegratedDetail();
        } catch (error) {
          if (
            getFinanceServiceUnavailableKind(error) !== "loading" ||
            statusCheckCountRef.current >= MAX_STATUS_CHECK_COUNT
          ) {
            throw error;
          }

          statusCheckCountRef.current += 1;
          setPageState("polling");
          setBackendStatus("requesting");
          setMessage(getUserFriendlyApiErrorMessage(error));
          await waitForPollingInterval();
        }
      }

      return true;
    }

    async function startCollectionWithLoadingRetry() {
      while (isCurrentRequest()) {
        try {
          return await startCollection(analysisTarget);
        } catch (error) {
          if (
            getFinanceServiceUnavailableKind(error) !== "loading" ||
            statusCheckCountRef.current >= MAX_STATUS_CHECK_COUNT
          ) {
            throw error;
          }

          statusCheckCountRef.current += 1;
          setPageState("polling");
          setBackendStatus("requesting");
          setMessage(getUserFriendlyApiErrorMessage(error));
          await waitForPollingInterval();
        }
      }

      return null;
    }

    async function run() {
      try {
        setPageState("collecting");
        setDataSource("none");
        setBackendStatus("requesting");
        setIsRunningAnalysis(true);
        setPageState("fetching");
        setMessage(`"${keyword}" 상세 분석 데이터를 불러오는 중입니다.`);

        const isFinished = await loadIntegratedDetailWithLoadingRetry();

        if (!isCurrentRequest() || isFinished) return;

        if (shouldRequestCollection) {
          const collectResponse = await startCollectionWithLoadingRetry();
          if (!collectResponse) return;
          if (!isCurrentRequest()) return;
          hasRequestedCollection = true;
          shouldRequestCollection = false;
          setPageState("polling");
          setMessage(
            collectResponse.message ??
              (collectResponse.status === "already_processing"
                ? "이미 수집이 진행 중입니다. 완료되면 자동으로 다시 불러옵니다."
                : `"${keyword}" 분석 상태를 확인 중입니다.`)
          );
        }

        const isPollingFinished = await pollIntegratedDetail();

        if (!isCurrentRequest() || isPollingFinished) return;

        pollingRef.current = setInterval(() => {
          void pollIntegratedDetail();
        }, POLLING_INTERVAL_MS);
      } catch (error) {
        if (!isCurrentRequest()) return;
        applyError(error, "상세 분석 요청 처리 중 오류가 발생했습니다.");
      }
    }

    void run();

    return () => {
      isActive = false;
      if (activeRequestKeyRef.current === requestKey) {
        activeRequestKeyRef.current = "";
      }
      clearPolling();
    };
  }, [
    applyError,
    analysisTarget,
    canAccessDetail,
    corpCode,
    displayName,
    keyword,
    resetInsightAsyncSections,
    setBackendStatus,
    setDataSource,
    setIsRunningAnalysis,
    stockCode,
  ]);

  function handleCompanySelect(company: CompanySearchResult) {
    router.push(buildCompanyAnalysisUrl("/detail", company));
  }

  function handleSimilarCompanySelect(company: SimilarCompanyApi) {
    const similarCompanyName = getSimilarCompanyName(company);
    const similarStockCode = getSimilarCompanyStockCode(company);

    router.push(
      buildCompanyAnalysisUrl("/detail", {
        keyword: similarStockCode || similarCompanyName,
        stockCode: similarStockCode || undefined,
        displayName: similarCompanyName,
      })
    );
  }

  const chartData = useMemo(() => {
    if (!summaryData?.history?.length) return [];
    return pickLatestAnalysisYears(summaryData.history);
  }, [summaryData]);

  const rawFinancialRows = useMemo(() => {
    return [...chartData].sort(
      (a, b) => parseYear(b.fiscal_year) - parseYear(a.fiscal_year)
    );
  }, [chartData]);

  const sortedHistory = useMemo(() => {
    if (!summaryData?.history?.length) return [];

    return [...summaryData.history].sort(
      (a, b) => Number(a.fiscal_year) - Number(b.fiscal_year)
    );
  }, [summaryData]);

  const isFinancialSector = useMemo(
    () =>
      resolveFinancialSector(
        summaryData,
        sortedHistory.at(-1)?.source_report
      ),
    [sortedHistory, summaryData]
  );

  const labels = useMemo(
    () => chartData.map((item) => String(item.fiscal_year)),
    [chartData]
  );

  const periodLabel = chartData.length > 0 ? `최근 ${chartData.length}개년` : "최근 5개년";
  const growthRateNotice =
    chartData.length > 1
      ? `전년 데이터가 필요한 성장률 지표는 ${periodLabel} 데이터 중 계산 가능한 최대 ${
          chartData.length - 1
        }개년 추이를 표시합니다.`
      : "성장률은 전년 대비 기준으로 계산되어 첫 연도는 표시되지 않을 수 있습니다.";

  const comprehensiveAnalysis = useMemo(
    () =>
      buildComprehensiveFinancialAnalysis(chartData, {
        isFinancialSector,
      }),
    [chartData, isFinancialSector]
  );

  const summaryCards = useMemo(
    () => buildSummaryTextCards(chartData),
    [chartData]
  );

  const profitSummaryCard = summaryCards.find(
    (card) => card.title === "손익 요약"
  );
  const ratioSummaryCard = summaryCards.find(
    (card) => card.title === "수익성/성장률 요약"
  );
  const balanceSummaryCard = summaryCards.find(
    (card) => card.title === "재무 상태 요약"
  );

  const profitCharts = useMemo<MiniChartConfig[]>(
    () => {
      const charts: MiniChartConfig[] = [
        {
          title: "매출",
          values: getValues(chartData, "revenue"),
          formatter: formatEok,
        },
        {
          title: "매출총이익",
          values: getValues(chartData, "gross_profit"),
          formatter: formatEok,
        },
        {
          title: "영업이익",
          values: getValues(chartData, "operating_profit"),
          formatter: formatEok,
          highlightProfitLoss: true,
        },
        {
          title: "당기순이익",
          values: getValues(chartData, "net_income"),
          formatter: formatEok,
          highlightProfitLoss: true,
        },
      ];

      return isFinancialSector
        ? charts.filter((chart) => chart.title === "당기순이익")
        : charts;
    },
    [chartData, isFinancialSector]
  );

  const ratioCharts = useMemo<MiniChartConfig[]>(() => {
    if (isFinancialSector) return [];

    const revenueGrowthSeries = getRatioSeries(
      chartData,
      sortedHistory,
      "revenue_growth_rate"
    );
    const revenueGrowthPoints = chartData
      .map((item, index) => ({
        label: String(item.fiscal_year),
        value: revenueGrowthSeries[index],
      }))
      .filter(
        (item): item is { label: string; value: number } =>
          typeof item.value === "number" && Number.isFinite(item.value)
      );

    return [
      {
        title: "영업이익률",
        values: getRatioSeries(chartData, sortedHistory, "operating_margin"),
        formatter: formatPercent,
      },
      {
        title: "순이익률",
        values: getRatioSeries(chartData, sortedHistory, "net_margin"),
        formatter: formatPercent,
      },
      {
        title: "매출 성장률",
        labels: revenueGrowthPoints.map((item) => item.label),
        values: revenueGrowthPoints.map((item) => item.value),
        formatter: formatPercent,
        note: growthRateNotice,
      },
    ];
  }, [chartData, growthRateNotice, isFinancialSector, sortedHistory]);

  const balanceCharts = useMemo<MiniChartConfig[]>(
    () => [
      {
        title: "자산",
        values: getValues(chartData, "total_assets"),
        formatter: formatEok,
      },
      {
        title: "부채",
        values: getValues(chartData, "total_liabilities"),
        formatter: formatEok,
      },
      {
        title: "자본",
        values: getValues(chartData, "equity"),
        formatter: formatEok,
      },
    ],
    [chartData]
  );

  const cashCharts = useMemo<MiniChartConfig[]>(
    () => [
      {
        title: "현금",
        values: getValues(chartData, "cash"),
        formatter: formatEok,
      },
    ],
    [chartData]
  );

  const financialInsights = useMemo(
    () => analyzeFinancialInsights(chartData, { isFinancialSector }),
    [chartData, isFinancialSector]
  );
  const profitQualityInsights = useMemo(
    () => financialInsights.filter(isProfitQualityInsight),
    [financialInsights]
  );
  const generalInsights = useMemo(
    () => financialInsights.filter((insight) => !isProfitQualityInsight(insight)),
    [financialInsights]
  );

  const hasChartData = chartData.length > 0;
  const latestData = getLatestValue(chartData);

  useEffect(() => {
    let isMounted = true;
    const requestStockCode = summaryData?.stock_code.trim() ?? "";
    const requestCompany = summaryData?.company_name.trim() ?? "";
    const requestLatestYear = latestData?.fiscal_year ?? summaryData?.fiscal_year;

    const requestInput = {
      stockCode: requestStockCode,
      company: requestCompany,
      latestYear: requestLatestYear ?? 0,
      insights: financialInsights,
    };
    const requestKey = getInsightInterpretationRequestKey(requestInput);

    if (
      pageState !== "completed" ||
      isFinancialSector ||
      !requestStockCode ||
      !requestCompany ||
      !requestLatestYear ||
      !requestKey
    ) {
      resetAiInsightInterpretation();
      return;
    }

    activeAiInsightRequestKeyRef.current = requestKey;
    let cacheEntry = aiInsightRequestCacheRef.current.get(requestKey);

    if (!cacheEntry) {
      const promise = interpretFinancialInsights({
        ...requestInput,
        latestYear: requestLatestYear,
      })
        .then<AiInsightInterpretationViewState>((response) => {
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
        })
        .catch<AiInsightInterpretationViewState>((error) => ({
          status: "error",
          interpretation: null,
          errorText: getInsightInterpretationErrorMessage(error),
        }));

      cacheEntry = { promise };
      aiInsightRequestCacheRef.current.set(requestKey, cacheEntry);

      void promise.then((result) => {
        const currentEntry = aiInsightRequestCacheRef.current.get(requestKey);

        if (currentEntry?.promise === promise) {
          currentEntry.result = result;
        }
      });
    }

    if (cacheEntry.result) {
      setAiInsightInterpretationState(cacheEntry.result);
    } else {
      setAiInsightInterpretationState({
        status: "loading",
        interpretation: null,
        errorText: "",
      });

      void cacheEntry.promise.then((result) => {
        if (
          !isMounted ||
          activeAiInsightRequestKeyRef.current !== requestKey
        ) {
          return;
        }

        setAiInsightInterpretationState(result);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [
    financialInsights,
    isFinancialSector,
    latestData,
    pageState,
    resetAiInsightInterpretation,
    summaryData,
  ]);

  useEffect(() => {
    let isMounted = true;
    const requestStockCode = summaryData?.stock_code.trim() ?? "";
    const ruleId = selectDisclosureRuleId(financialInsights);
    const requestKey =
      /^\d{6}$/.test(requestStockCode) && ruleId
        ? `${requestStockCode}:${ruleId}`
        : null;

    if (pageState !== "completed" || !requestKey) {
      resetRelatedDisclosures();
      return;
    }

    activeRelatedDisclosuresRequestKeyRef.current = requestKey;
    let cacheEntry = relatedDisclosuresRequestCacheRef.current.get(requestKey);

    if (!cacheEntry) {
      const promise = getFinancialDisclosures({
        stockCode: requestStockCode,
        insights: financialInsights,
      })
        .then<RelatedDisclosuresViewState>((response) => {
          const disclosures = Array.isArray(response?.disclosures)
            ? response.disclosures
            : [];

          return {
            status: disclosures.length > 0 ? "success" : "empty",
            disclosures,
            errorText: "",
          };
        })
        .catch<RelatedDisclosuresViewState>((error) => ({
          status: "error",
          disclosures: [],
          errorText: getRelatedDisclosuresErrorMessage(error),
        }));

      cacheEntry = { promise };
      relatedDisclosuresRequestCacheRef.current.set(requestKey, cacheEntry);

      void promise.then((result) => {
        const currentEntry =
          relatedDisclosuresRequestCacheRef.current.get(requestKey);

        if (currentEntry?.promise === promise) {
          currentEntry.result = result;
        }
      });
    }

    if (cacheEntry.result) {
      setRelatedDisclosuresState(cacheEntry.result);
    } else {
      setRelatedDisclosuresState({
        status: "loading",
        disclosures: [],
        errorText: "",
      });

      void cacheEntry.promise.then((result) => {
        if (
          !isMounted ||
          activeRelatedDisclosuresRequestKeyRef.current !== requestKey
        ) {
          return;
        }

        setRelatedDisclosuresState(result);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [financialInsights, pageState, resetRelatedDisclosures, summaryData]);

  const previousData =
    chartData.length > 1 ? chartData[chartData.length - 2] : null;
  const latestRevenueGrowth =
    getLatestValue(getRatioSeries(chartData, sortedHistory, "revenue_growth_rate")) ??
    calculateGrowthRate(latestData?.revenue, previousData?.revenue);
  const latestOperatingProfitGrowth = calculateGrowthRate(
    latestData?.operating_profit,
    previousData?.operating_profit
  );
  const latestOperatingMargin = getLatestValue(
    getRatioSeries(chartData, sortedHistory, "operating_margin")
  );
  const latestNetMargin = getLatestValue(
    getRatioSeries(chartData, sortedHistory, "net_margin")
  );
  const latestDebtRatio = getDebtRatio(latestData);
  const latestEquityRatio = getEquityRatio(latestData);
  const latestRoe = getRoe(latestData);
  const latestRoa = getRoa(latestData);
  const sectorComparisonItems = buildSectorComparisonItems({
    companyMetrics: {
      revenue_growth_rate: latestRevenueGrowth,
      operating_margin: latestOperatingMargin,
      net_margin: latestNetMargin,
      roe: latestRoe,
      roa: latestRoa,
      debt_ratio: latestDebtRatio,
    },
    sectorAverage: summaryData?.sector_avg,
    sectorRank: summaryData?.sector_rank,
    isFinancialSector,
  });
  const sectorText =
    getNonEmptyText(summaryData?.sector) ||
    getOptionalString(summaryData, [
      "industry",
      "industryName",
      "industry_name",
      "businessType",
      "corpClass",
    ]) ||
    "정보 없음";
  const sectorAverageSampleSize = getSectorAverageSampleSize(summaryData);
  const shouldShowSectorAverageNotice =
    sectorAverageSampleSize !== null && sectorAverageSampleSize < 3;
  const businessText = getOptionalString(summaryData, [
    "business",
    "businessSummary",
    "business_summary",
    "mainBusiness",
    "main_business",
    "mainProducts",
    "productSummary",
    "description",
  ]) ?? "";
  const shouldShowBusinessCard = !!businessText;
  const overviewInfoGridClassName = "mt-5 grid grid-cols-1 gap-3 md:grid-cols-2";
  const sectorCardClassName = [
    "rounded-lg border border-sky-100 bg-white/80 px-4 py-4",
    shouldShowBusinessCard ? "" : "md:col-span-2",
  ]
    .filter(Boolean)
    .join(" ");
  const overviewLongTextClassName =
    "mt-2 text-base font-semibold leading-relaxed break-keep text-slate-950 line-clamp-3";
  const overviewMetrics: DetailMetricCard[] = [
    {
      label: "성장성",
      value: summaryData?.growth_status ?? "-",
      description: "매출과 이익의 최근 흐름을 바탕으로 본 상태입니다.",
      valueClassName: getFinancialStatusTextClass(summaryData?.growth_status),
    },
    {
      label: "안정성",
      value: summaryData?.stability_status ?? "-",
      description: "자산, 부채, 자본 구조를 바탕으로 본 상태입니다.",
      valueClassName: getFinancialStatusTextClass(summaryData?.stability_status),
    },
    {
      label: "수익성",
      value: summaryData?.profitability_status ?? "-",
      description: "영업이익과 순이익 흐름을 바탕으로 본 상태입니다.",
      valueClassName: getFinancialStatusTextClass(
        summaryData?.profitability_status
      ),
    },
  ];
  const generalKeyFinancialMetrics: DetailMetricCard[] = [
    {
      label: "매출액",
      value: formatEok(latestData?.revenue),
      description: "기업의 외형 규모를 보여주는 핵심 지표입니다.",
    },
    {
      label: "영업이익",
      value: formatEok(latestData?.operating_profit),
      description: "본업에서 벌어들인 이익입니다.",
    },
    {
      label: "당기순이익",
      value: formatEok(latestData?.net_income),
      description: "최종적으로 기업에 남은 이익입니다.",
    },
    {
      label: "매출성장률",
      value: formatSignedPercent(latestRevenueGrowth, 1),
      description: "직전 연도 대비 매출 증가율입니다.",
    },
    {
      label: "영업이익률",
      value: formatPercent(latestOperatingMargin),
      description: "매출 대비 영업이익 비중입니다.",
    },
    {
      label: "순이익률",
      value: formatPercent(latestNetMargin),
      description: "매출 대비 최종 이익 비중입니다.",
    },
    {
      label: "부채비율",
      value: formatPercent(latestDebtRatio),
      description: "자본 대비 부채 부담을 보여줍니다.",
    },
  ];
  const financialKeyMetrics: DetailMetricCard[] = [
    {
      label: "당기순이익",
      value: formatEok(latestData?.net_income),
      description: "금융업의 최종 이익 규모입니다.",
    },
    {
      label: "총자산",
      value: formatEok(latestData?.total_assets),
      description: "금융업의 전체 자산 규모입니다.",
    },
    {
      label: "자본총계",
      value: formatEok(latestData?.equity),
      description: "자산에서 부채를 제외한 자기자본입니다.",
    },
    {
      label: "ROE",
      value: formatPercent(latestRoe),
      description: "자기자본 대비 순이익 비율입니다.",
    },
    {
      label: "ROA",
      value: formatPercent(latestRoa),
      description: "총자산 대비 순이익 비율입니다.",
    },
    {
      label: "부채비율",
      value: formatPercent(latestDebtRatio),
      description: "자본 대비 부채 부담을 보여줍니다.",
    },
  ];
  const keyFinancialMetrics = isFinancialSector
    ? financialKeyMetrics
    : generalKeyFinancialMetrics;
  const investmentReferenceMetrics: MetricInsightCardProps[] = [
    {
      title: "ROE",
      value: latestRoe == null ? "정보 부족" : formatPercent(latestRoe),
      grade: getRoeRating(latestRoe),
      description: getInvestmentMetricDescription("roe", latestRoe),
      facts: [
        { label: "계산식", value: "당기순이익 / 자본총계" },
        { label: "당기순이익", value: formatEok(latestData?.net_income) },
        { label: "자본총계", value: formatEok(latestData?.equity) },
      ],
      criteria: "20% 이상이면 우수, 10% 이상이면 양호로 봅니다.",
    },
    {
      title: "이익 체력",
      grade: getProfitPowerRating(latestOperatingMargin, latestNetMargin),
      description: getInvestmentMetricDescription("profit"),
      facts: [
        { label: "영업이익률", value: formatPercent(latestOperatingMargin) },
        { label: "순이익률", value: formatPercent(latestNetMargin) },
      ],
      criteria: "영업이익률 10% 이상, 순이익률 8% 이상이면 우수로 봅니다.",
    },
    {
      title: "재무 여력",
      grade: getFinancialCapacityRating(
        latestDebtRatio,
        latestEquityRatio,
        latestData?.cash
      ),
      description: getInvestmentMetricDescription("capacity"),
      facts: [
        { label: "부채비율", value: formatPercent(latestDebtRatio) },
        { label: "자기자본비율", value: formatPercent(latestEquityRatio) },
        { label: "현금", value: formatEok(latestData?.cash) },
      ],
      criteria: "부채비율 100% 이하, 자기자본비율 50% 이상이면 우수로 봅니다.",
    },
    {
      title: "성장 모멘텀",
      grade: getGrowthMomentumRating(
        latestRevenueGrowth,
        latestOperatingProfitGrowth
      ),
      description: getInvestmentMetricDescription("growth"),
      facts: [
        { label: "매출성장률", value: formatSignedPercent(latestRevenueGrowth, 1) },
        {
          label: "영업이익 증가율",
          value: formatSignedPercent(latestOperatingProfitGrowth, 1),
        },
      ],
      criteria: "매출과 영업이익이 모두 10% 이상 증가하면 우수로 봅니다.",
    },
  ];
  const visibleInvestmentReferenceMetrics = isFinancialSector
    ? investmentReferenceMetrics.filter(
        (metric) => metric.title === "ROE" || metric.title === "재무 여력"
      )
    : investmentReferenceMetrics;
  return (
    <PageFrame
      title="상세 분석"
      description="기업의 재무 데이터를 상세히 분석합니다."
      icon={FileBarChart2}
    >
      <div className="grid min-w-0 gap-3 lg:grid-cols-[210px_minmax(0,1fr)] 2xl:grid-cols-[220px_minmax(900px,1fr)]">
        <div className={isLoading ? "min-w-0 opacity-60 transition lg:sticky lg:top-24 lg:self-start" : "min-w-0 transition lg:sticky lg:top-24 lg:self-start"}>
          <RelatedCompanyList title="최근 본 기업" />
        </div>

        <div className="min-w-0 space-y-5 pb-4">
          <CompanySearchBar
            initialKeyword={displayName ?? keyword}
            onSelect={handleCompanySelect}
            placeholder="상세 분석할 기업명 또는 종목코드를 입력하세요"
          />

          {!canAccessDetail ? (
            <FeatureLockedCard
              title="상세 분석 이용 안내"
              description="상세 분석은 로그인 후 이용할 수 있습니다."
            />
          ) : !keyword ? (
            <Box className="p-6">
              <StatusState
                variant="info"
                title="상세 분석할 기업을 선택해주세요"
                description="메인 화면 또는 3줄 요약 화면에서 기업명을 선택하면 상세 분석을 확인할 수 있습니다."
              />
            </Box>
          ) : null}

          {canAccessDetail && isLoading && (
            <Box className="p-10 text-center">
              <StatusState
                variant="loading"
                title={`${displayName ?? keyword} 상세 분석 진행 중`}
                description={message}
                className="text-left"
              />
            </Box>
          )}

          {canAccessDetail && pageState === "error" && (
            <Box className="p-10 text-center">
              <StatusState
                variant="error"
                title={STATUS_MESSAGES.dataError}
                description={errorText || "잠시 후 다시 시도해주세요."}
                className="text-left"
              />
            </Box>
          )}

          {canAccessDetail && pageState === "timeout" && (
            <Box className="p-10 text-center">
              <StatusState
                variant="warning"
                title="아직 수집이 완료되지 않았습니다"
                description={message || POLLING_TIMEOUT_MESSAGE}
                className="text-left"
              />
            </Box>
          )}

          {canAccessDetail && summaryData && (
            <>
              <Box className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SectionLabel>기업 개요</SectionLabel>
                    <h2 className="break-words text-2xl font-semibold tracking-tight text-slate-900">
                      {summaryData.company_name}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      최신 재무 데이터 기준으로 기업의 성장성, 수익성, 안정성을
                      한 화면에서 확인합니다.
                    </p>
                    <p className="mt-3 text-xs text-slate-400">
                      {[summaryData.stock_code, `${summaryData.fiscal_year}년 결산 기준`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {overviewMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className={DETAIL_SURFACE_CLASSNAME}
                    >
                      <div className="text-xs text-slate-500">
                        {metric.label}
                      </div>
                      <div
                        className={`mt-2 text-lg font-semibold ${metric.valueClassName ?? "text-slate-900"}`}
                      >
                        {metric.value}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {metric.description}
                      </p>
                    </div>
                  ))}
                </div>

                <div className={overviewInfoGridClassName}>
                  <div className={sectorCardClassName}>
                    <div className="text-xs text-slate-500">업종</div>
                    <div
                      className={overviewLongTextClassName}
                      title={sectorText}
                    >
                      {sectorText}
                    </div>
                  </div>
                  {shouldShowBusinessCard && (
                    <div className="rounded-lg border border-slate-200 bg-white/70 px-4 py-4">
                      <div className="text-xs text-slate-500">주요 사업</div>
                      <p
                        className={overviewLongTextClassName}
                        title={businessText}
                      >
                        {businessText}
                      </p>
                    </div>
                  )}
                </div>
              </Box>

              <Box className="p-6">
                <SectionLabel>핵심 재무 요약</SectionLabel>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {keyFinancialMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className={DETAIL_SURFACE_CLASSNAME}
                    >
                      <div className="text-xs text-slate-500">
                        {metric.label}
                      </div>
                      <div className="mt-2 text-xl font-semibold text-slate-900">
                        {metric.value}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {metric.description}
                      </p>
                    </div>
                  ))}
                </div>
              </Box>

              <SectorComparisonSection
                items={sectorComparisonItems}
                sampleSize={sectorAverageSampleSize}
              />

              <Box className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <SectionLabel>재무제표 기반 종합 분석</SectionLabel>
                    <p className="mt-2 text-sm text-slate-500">
                      최근 재무 흐름과 주요 변곡점을 규칙 기반으로 요약했습니다.
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${getComprehensiveStatusClassName(
                      comprehensiveAnalysis.status
                    )}`}
                  >
                    {comprehensiveAnalysis.statusLabel}
                  </span>
                </div>

                <div className="mt-5 rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/90 to-white px-4 py-4 sm:px-5">
                  <div className="text-xs font-semibold tracking-wide text-slate-500">
                    현재 상태
                  </div>
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-2 text-sm leading-6 text-slate-700">
                    {comprehensiveAnalysis.currentYear && (
                      <span className="font-semibold text-slate-950">
                        {comprehensiveAnalysis.currentYear}년
                      </span>
                    )}
                    {comprehensiveAnalysis.currentMetrics.length > 0 ? (
                      comprehensiveAnalysis.currentMetrics.map((metric, index) => (
                        <span
                          key={metric.key}
                          className="inline-flex max-w-full items-baseline gap-1 break-keep"
                        >
                          {index > 0 && (
                            <span className="mr-1 text-slate-300" aria-hidden="true">
                              ·
                            </span>
                          )}
                          <span className="text-slate-500">{metric.label}</span>
                          <strong className="font-semibold text-slate-950">
                            {metric.unit === "currency"
                              ? formatEok(metric.value)
                              : formatPercent(metric.value)}
                          </strong>
                        </span>
                      ))
                    ) : (
                      <span>표시할 수 있는 최신 핵심 지표가 없습니다.</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold tracking-wide text-slate-500">
                        5개년 흐름
                      </div>
                      <span className="text-xs text-slate-400">
                        {comprehensiveAnalysis.periodLabel}
                      </span>
                    </div>
                    <p className="mt-3 break-keep text-sm leading-7 text-slate-700">
                      {comprehensiveAnalysis.flowSummary}
                    </p>
                  </div>

                  <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-5">
                    <div className="text-xs font-semibold tracking-wide text-slate-500">
                      주요 변화
                    </div>
                    {comprehensiveAnalysis.changes.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                        {comprehensiveAnalysis.changes.map((change) => (
                          <li key={change} className="flex min-w-0 gap-2">
                            <span
                              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-700"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-keep">{change}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        표시할 만큼 뚜렷한 변곡점이 없습니다.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-950 px-4 py-4 text-white sm:flex-row sm:items-center sm:px-5">
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-medium text-slate-300">
                      종합 상태
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
                      {comprehensiveAnalysis.statusLabel}
                    </span>
                  </div>
                  <p className="min-w-0 break-keep text-sm leading-6 text-slate-200 sm:border-l sm:border-white/15 sm:pl-4">
                    {comprehensiveAnalysis.statusReason}
                  </p>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-400">
                  ⓘ 분석 기준: {comprehensiveAnalysis.basisLabel}
                </p>
              </Box>

              <AiReportSlot
                title="AI 상세 분석"
                description="성장성, 수익성, 안정성 흐름을 바탕으로 핵심 내용을 정리합니다."
                enabled={ENABLE_AI_ANALYSIS}
                status={aiReportState.status}
                analysis={aiReportState.analysis}
                errorText={aiReportState.errorText}
              />

              {!hasChartData ? (
                <Box className="p-6">
                  <SectionLabel>{periodLabel} 데이터</SectionLabel>
                  <p className="mt-3 text-sm text-slate-600">
                    아직 표시할 {periodLabel} 재무 데이터가 없습니다.
                  </p>
                </Box>
              ) : (
                <>
                  {/* 핵심 재무 흐름 */}
                  <div className="space-y-4">
                  <Box className="p-6">
                    <SectionLabel>
                      {isFinancialSector ? "금융업 이익 흐름" : "성장성 분석"}
                    </SectionLabel>
                    <p className="mt-2 text-sm text-slate-500">
                      {isFinancialSector
                        ? `${periodLabel} 당기순이익 흐름을 확인합니다.`
                        : `${periodLabel} 매출, 이익, 성장률 흐름을 함께 확인합니다.`}
                    </p>

                    <div className={`mt-5 ${CHART_GRID_CLASSNAME}`}>
                      {profitCharts.map((chart) => (
                        <div
                          key={chart.title}
                          className={DETAIL_CHART_CARD_CLASSNAME}
                        >
                          <SectionLabel>{chart.title}</SectionLabel>
                          <div className="mt-4">
                            <SimpleLineChart
                              title={chart.title}
                              labels={chart.labels ?? labels}
                              values={chart.values}
                              valueFormatter={chart.formatter}
                              highlightProfitLoss={chart.highlightProfitLoss}
                              compact
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {!isFinancialSector && profitSummaryCard && (
                      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                        <SectionLabel>{profitSummaryCard.title}</SectionLabel>
                        <p>{profitSummaryCard.content}</p>
                      </div>
                    )}
                  </Box>

                  {ratioCharts.length > 0 && <Box className="p-6">
                    <SectionLabel>수익성 분석</SectionLabel>
                    <p className="mt-2 text-sm text-slate-500">
                      비율 지표는 금액과 분리해 영업이익률, 순이익률, 매출 성장률
                      흐름을 따로 확인합니다.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      성장률은 전년 대비 기준으로 계산되어 첫 연도는 표시되지 않을 수 있습니다.
                    </p>

                    <div className={`mt-5 ${CHART_GRID_CLASSNAME}`}>
                      {ratioCharts.map((chart) => (
                        <div
                          key={chart.title}
                          className={DETAIL_CHART_CARD_CLASSNAME}
                        >
                          <SectionLabel>{chart.title}</SectionLabel>
                          <div className="mt-4">
                            <SimpleLineChart
                              title={chart.title}
                              labels={chart.labels ?? labels}
                              values={chart.values}
                              valueFormatter={chart.formatter}
                              compact
                              yAxisWidth={58}
                            />
                          </div>
                          {chart.note && (
                            <p className="mt-3 text-xs leading-5 text-slate-500">
                              {chart.note}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {ratioSummaryCard && (
                      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                        <SectionLabel>{ratioSummaryCard.title}</SectionLabel>
                        <p>{ratioSummaryCard.content}</p>
                      </div>
                    )}
                  </Box>}

                  <Box className="p-6">
                    <SectionLabel>안정성 분석</SectionLabel>
                    <p className="mt-2 text-sm text-slate-500">
                      자산, 부채, 자본과 현금 보유 수준을 함께 보며 재무 구조와
                      유동성 여력을 확인합니다.
                    </p>

                    <div className={`mt-5 ${CHART_GRID_CLASSNAME}`}>
                      {[...balanceCharts, ...cashCharts].map((chart) => (
                        <div
                          key={chart.title}
                          className={DETAIL_CHART_CARD_CLASSNAME}
                        >
                          <SectionLabel>{chart.title}</SectionLabel>
                          <div className="mt-4">
                            <SimpleLineChart
                              title={chart.title}
                              labels={chart.labels ?? labels}
                              values={chart.values}
                              valueFormatter={chart.formatter}
                              compact
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <div className={DETAIL_SURFACE_CLASSNAME}>
                        <div className="text-xs text-slate-500">부채비율</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">
                          {formatPercent(latestDebtRatio)}
                        </div>
                      </div>
                      <div className={DETAIL_SURFACE_CLASSNAME}>
                        <div className="text-xs text-slate-500">
                          자기자본비율
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">
                          {formatPercent(latestEquityRatio)}
                        </div>
                      </div>
                      <div className={DETAIL_SURFACE_CLASSNAME}>
                        <div className="text-xs text-slate-500">현금</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">
                          {formatEok(latestData?.cash)}
                        </div>
                      </div>
                    </div>

                    {balanceSummaryCard && (
                      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                        <SectionLabel>{balanceSummaryCard.title}</SectionLabel>
                        <p>{balanceSummaryCard.content}</p>
                      </div>
                    )}
                  </Box>

                  {isFinancialSector ? (
                    <Box className="p-6">
                      <SectionLabel>비용 구조</SectionLabel>
                      <StatusState
                        variant="empty"
                        title="금융업 비용 구조 안내"
                        description="금융업은 일반 기업과 비용 구조가 달라 이 차트를 제공하지 않습니다."
                        compact
                        className="mt-5"
                      />
                    </Box>
                  ) : (
                    <Box className="p-6">
                      <SectionLabel>매출과 비용 흐름</SectionLabel>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        영업비용 추정치는 매출액에서 영업이익을 뺀 값으로, 매출 대비 비용 부담의 흐름을 살펴보기 위한 참고 지표입니다.
                      </p>
                      <CostFlowChart
                        history={chartData}
                        valueFormatter={formatEok}
                      />
                    </Box>
                  )}
                  </div>

                  {/* 실적 해석 */}
                  <div className="space-y-4 empty:hidden">
                  <FinancialInsightsSection
                    insights={generalInsights}
                    currencyFormatter={formatEok}
                  />

                  <ProfitQualitySection
                    insights={profitQualityInsights}
                    currencyFormatter={formatEok}
                  />

                  <AiInsightInterpretationSection
                    status={aiInsightInterpretationState.status}
                    interpretation={aiInsightInterpretationState.interpretation}
                    errorText={aiInsightInterpretationState.errorText}
                  />

                  <RelatedDisclosuresSection
                    status={relatedDisclosuresState.status}
                    disclosures={relatedDisclosuresState.disclosures}
                    errorText={relatedDisclosuresState.errorText}
                  />
                  </div>

                  {/* 손익 구조 상세 */}
                  <div className="space-y-4">
                  {!isFinancialSector && (
                    <Box className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <SectionLabel>실제 비용 구성</SectionLabel>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            공시된 매출원가, 판매비와관리비, 영업이익을 연도별로
                            쌓아 실제 영업 구조를 비교합니다.
                          </p>
                        </div>
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                          실제 계정
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        세 항목 중 하나라도 미수집된 연도는 구성 차트에서
                        제외하며, 미수집 값을 0으로 계산하지 않습니다.
                      </p>
                      <CostCompositionChart
                        history={chartData}
                        valueFormatter={formatEok}
                      />
                    </Box>
                  )}

                  <PostOperatingProfitFlow
                    history={chartData}
                    isFinancialSector={isFinancialSector}
                    valueFormatter={formatEok}
                  />
                  </div>

                  <Box className="p-6">
                    <SectionLabel>투자 참고 지표</SectionLabel>
                    <p className="mt-2 text-sm text-slate-500">
                      현재 제공되는 재무제표 데이터를 바탕으로 투자 판단에
                      참고할 수 있는 보조 지표를 정리했습니다. 등급은
                      업종별 차이를 반영하지 않은 단순 참고 기준입니다.
                    </p>
                    {shouldShowSectorAverageNotice && (
                      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
                        동종업계 표본이 3개 미만이라 업종 평균 신뢰도가 낮을 수 있습니다.
                      </p>
                    )}
                    <div className="mt-5 grid grid-cols-1 gap-4">
                      {visibleInvestmentReferenceMetrics.map((metric) => (
                        <MetricInsightCard key={metric.title} {...metric} />
                      ))}
                    </div>
                  </Box>

                  <Box className="p-6">
                    <SectionLabel>원본 재무제표</SectionLabel>
                    <p className="mt-2 text-sm text-slate-500">
                      {periodLabel} 주요 재무 항목을 표로 정리했습니다.
                    </p>
                    <TableFrame
                      className="mt-5"
                      ariaLabel={`${periodLabel} 기본 재무제표`}
                      caption={`${periodLabel} 기본 재무제표, 단위는 억원 또는 조원`}
                    >
                        <thead className="bg-slate-50 text-slate-700">
                          <tr>
                            <th className="sticky left-0 z-10 min-w-20 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold" scope="col">
                              연도
                            </th>
                            {!isFinancialSector && (
                              <>
                                <th className="min-w-32 border-b border-slate-200 px-4 py-3 text-right font-semibold" scope="col">
                                  매출액
                                </th>
                                <th className="min-w-32 border-b border-slate-200 px-4 py-3 text-right font-semibold" scope="col">
                                  영업이익
                                </th>
                              </>
                            )}
                            <th className="min-w-32 border-b border-slate-200 px-4 py-3 text-right font-semibold" scope="col">
                              당기순이익
                            </th>
                            <th className="min-w-32 border-b border-slate-200 px-4 py-3 text-right font-semibold" scope="col">
                              자산총계
                            </th>
                            <th className="min-w-32 border-b border-slate-200 px-4 py-3 text-right font-semibold" scope="col">
                              부채총계
                            </th>
                            <th className="min-w-32 border-b border-slate-200 px-4 py-3 text-right font-semibold" scope="col">
                              자본총계
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rawFinancialRows.map((item) => (
                            <tr key={item.fiscal_year} className="bg-white">
                              <th className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-3 text-left font-medium text-slate-900" scope="row">
                                {item.fiscal_year}
                              </th>
                              {!isFinancialSector && (
                                <>
                                  <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">
                                    {formatEok(item.revenue)}
                                  </td>
                                  <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">
                                    {formatEok(item.operating_profit)}
                                  </td>
                                </>
                              )}
                              <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">
                                {formatEok(item.net_income)}
                              </td>
                              <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">
                                {formatEok(item.total_assets)}
                              </td>
                              <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">
                                {formatEok(item.total_liabilities)}
                              </td>
                              <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">
                                {formatEok(item.equity)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                    </TableFrame>
                  </Box>
                </>
              )}

              <Box className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SectionLabel>유사 기업 추천</SectionLabel>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      최근 수집 데이터 기준으로 같은 업종과 비슷한 재무 흐름을 가진 기업입니다.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    캐시 300초
                  </span>
                </div>

                {similarCompaniesStatus === "loading" && (
                  <StatusState
                    variant="loading"
                    title="유사 기업을 찾는 중입니다"
                    description="현재 기업과 재무 흐름이 비슷한 기업을 확인하고 있습니다."
                    compact
                    className="mt-5"
                  />
                )}

                {similarCompaniesStatus === "empty" && (
                  <StatusState
                    variant="empty"
                    title="조건에 맞는 유사 기업을 찾지 못했습니다"
                    description="같은 업종과 재무 상태 기준을 만족하는 기업이 아직 없습니다."
                    compact
                    className="mt-5"
                  />
                )}

                {similarCompaniesStatus === "error" && (
                  <StatusState
                    variant="warning"
                    title="유사 기업을 불러오지 못했습니다"
                    description={
                      similarCompaniesErrorText ||
                      "잠시 후 다시 확인해 주세요."
                    }
                    compact
                    className="mt-5"
                  />
                )}

                {similarCompaniesStatus === "success" && (
                  <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    {similarCompanies.map((company, index) => {
                      const similarName = getSimilarCompanyName(company);
                      const similarStockCode =
                        getSimilarCompanyStockCode(company);
                      const similarReason = getSimilarCompanyReason(company);
                      const matchCount = toFiniteNumber(company.match_count);
                      const revenue = toFiniteNumber(company.revenue);
                      const operatingProfit = toFiniteNumber(
                        company.operating_profit
                      );
                      const operatingMargin = toFiniteNumber(
                        company.operating_margin
                      );
                      const statusChips = [
                        company.growth_status,
                        company.profitability_status,
                        company.stability_status,
                      ].filter(
                        (value): value is string =>
                          typeof value === "string" && !!value.trim()
                      );

                      return (
                        <div
                          key={`${similarStockCode || similarName}-${index}`}
                          className="min-w-0 rounded-lg border border-sky-100 bg-white/80 p-4 shadow-sm shadow-sky-100/40"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="line-clamp-2 break-words text-base font-semibold leading-6 text-slate-950">
                                {similarName}
                              </h3>
                              <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                                {[similarStockCode, company.sector]
                                  .filter(Boolean)
                                  .join(" · ") || "기업 정보 확인 중"}
                              </p>
                            </div>
                            {matchCount !== null && (
                              <StatusBadge tone="neutral" className="shrink-0 whitespace-nowrap">
                                일치 지표 {matchCount}개
                              </StatusBadge>
                            )}
                          </div>

                          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-slate-50 px-3 py-2">
                              <dt className="text-slate-500">매출</dt>
                              <dd className="mt-1 font-semibold text-slate-900">
                                {revenue === null ? "-" : formatEok(revenue)}
                              </dd>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-3 py-2">
                              <dt className="text-slate-500">영업이익</dt>
                              <dd className="mt-1 font-semibold text-slate-900">
                                {operatingProfit === null
                                  ? "-"
                                  : formatEok(operatingProfit)}
                              </dd>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-3 py-2">
                              <dt className="text-slate-500">영업이익률</dt>
                              <dd className="mt-1 font-semibold text-slate-900">
                                {operatingMargin === null
                                  ? "-"
                                  : `${operatingMargin.toFixed(1)}%`}
                              </dd>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-3 py-2">
                              <dt className="text-slate-500">기준연도</dt>
                              <dd className="mt-1 font-semibold text-slate-900">
                                {company.fiscal_year ?? "-"}
                              </dd>
                            </div>
                          </dl>

                          {statusChips.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {statusChips.map((status) => (
                                <span
                                  key={status}
                                  className={`max-w-full break-words rounded-lg border px-2 py-1 text-xs leading-5 ${getFinancialStatusChipClass(
                                    status
                                  )}`}
                                >
                                  {status}
                                </span>
                              ))}
                            </div>
                          )}

                          {similarReason && (
                            <p className="mt-3 line-clamp-3 break-words text-xs leading-relaxed text-slate-500">
                              {similarReason}
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSimilarCompanySelect(company)}
                            className="mt-4 inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          >
                            상세 보기
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Box>
            </>
          )}
        </div>

      </div>
      <ScrollTopButton />
    </PageFrame>
  );
}

export default function DetailPage() {
  return (
    <Suspense fallback={null}>
      <DetailPageContent />
    </Suspense>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Check,
  Copy,
  HelpCircle,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Share2,
  X,
} from "lucide-react";
import { CompanyChip, StatusBadge } from "@/components/common/Badge";
import Button from "@/components/common/Button";
import { InnerSurface, TableFrame } from "@/components/common/Card";
import ScrollTopButton from "@/components/common/ScrollTopButton";
import { StatusState } from "@/components/common/StatusState";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageFrame from "@/components/financial/PageFrame";
import AiReportSlot from "@/components/financial/AiReportSlot";
import RelatedCompanyList from "@/components/financial/RelatedCompanyList";
import Box from "@/components/financial/Box";
import SectionLabel from "@/components/financial/SectionLabel";
import { useDataSource } from "@/components/layout/DataSourceProvider";
import { useMockAuth } from "@/hooks/useMockAuth";
import { useCompanySearch } from "@/hooks/useCompanySearch";
import {
  createCompareShareLink,
  getRecommendedCompanies,
  getSummary,
  getUserFriendlyApiErrorMessage,
} from "@/lib/api";
import { formatCompareShareExpiry } from "@/lib/compareShare";
import { canUseFeature } from "@/lib/featureAccess";
import {
  FINANCIAL_STATUS_TEXT_TERMS,
  getFinancialStatusChipClass,
  getFinancialStatusTextClass,
  isPositiveFinancialStatus,
} from "@/lib/financialStatusStyle";
import { STATUS_MESSAGES } from "@/lib/statusMessages";
import {
  formatCurrency,
  formatNumber,
  formatPercent as formatPercentValue,
  type NumericValue,
} from "@/lib/format";
import {
  buildCompareReport,
  buildPerspectiveCards,
  buildThreeLineFinancialSummary,
  getComparePoint,
} from "@/lib/financialNarratives";
import {
  calculateDebtRatio,
  calculateEquityRatio,
  calculateFinancialGrowth,
  calculateROA,
  calculateROE,
  getFinancialMetricValue,
  isValidNumber,
  pickLatestFinancialYears,
  sortFinancialHistory,
} from "@/lib/financialNormalize";
import {
  type CompanyAnalysisTarget,
  type CompanySearchItem,
  getCompanyDisplayName,
  toCompanyAnalysisTarget,
} from "@/lib/companySearch";
import type {
  CompanySummaryApiResponse,
  RecommendedCompanyApi,
  YearlyDataApi,
} from "@/types/api";

type CompanyFetchResult =
  | {
      company: string;
      data: CompanySummaryApiResponse;
    }
  | {
      company: string;
      error: string;
    };

type CompareCompanyData = {
  inputName: string;
  displayName: string;
  stockCode: string;
  history: YearlyDataApi[];
  latest: YearlyDataApi | null;
  summaryText: string;
  summaryLines: string[];
  error?: string;
};

type SelectedCompareCompany = CompanyAnalysisTarget & {
  name: string;
  market?: string;
  sector?: string;
  industry?: string;
  business?: string;
};

type RecommendationStatus = "idle" | "loading" | "success" | "empty" | "error";

type CompareTableRow = {
  label: string;
  point: string;
  higherIsBetter: boolean;
  values: Array<{
    companyName: string;
    rawValue: NumericValue;
    value: string;
    isBest: boolean;
  }>;
};

type CompareTableGroup = {
  title: string;
  description: string;
  rows: CompareTableRow[];
};

type CompareValueFormat = "currency" | "percent" | "number";

type ComparisonRowConfig = {
  label: string;
  format: CompareValueFormat;
  description: string;
  higherIsBetter: boolean;
  getValue: (company: CompareCompanyData) => NumericValue;
};

function isErrorResult(
  item: CompanyFetchResult
): item is { company: string; error: string } {
  return "error" in item;
}

function isDataResult(
  item: CompanyFetchResult
): item is { company: string; data: CompanySummaryApiResponse } {
  return "data" in item;
}

type CompareMultiLineCardProps = {
  title: string;
  description: string;
  labels: string[];
  series: {
    name: string;
    color: string;
    values: Array<number | null>;
  }[];
  formatter: (value: NumericValue) => string;
};

type CompareBarCardProps = {
  title: string;
  description: string;
  data: Array<Record<string, string | number | null>>;
  series: Array<{
    name: string;
    color: string;
  }>;
  formatter: (value: NumericValue) => string;
};

const COMPARE_CHART_COLORS = [
  "#16a34a",
  "#2563eb",
  "#FBC424",
  "#0891b2",
];
const SECONDARY_SERIES_COLORS = ["#15803d", "#1d4ed8", "#d99a00", "#0e7490"];
const CHART_TOOLTIP_CONTAINER_STYLE = { zIndex: 60 };
const CHART_TOOLTIP_CONTENT_STYLE = {
  maxWidth: 280,
  borderRadius: 10,
  borderColor: "#bae6fd",
  padding: "10px 12px",
  boxShadow: "0 16px 32px rgba(15, 23, 42, 0.14)",
  lineHeight: "1.5",
  whiteSpace: "normal" as const,
};
const MAX_COMPARE_SELECTION_COUNT = 3;
const MIN_COMPARE_SELECTION_COUNT = 2;
const RECOMMENDATION_LIMIT = 5;

function normalizeCompareQueryValue(value: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) return "";

  return trimmed.slice(0, 80);
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
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600">
        {description}
      </div>
    </Box>
  );
}

function formatKoreanMoney(value: NumericValue) {
  if (!hasNumericValue(value)) {
    return "-";
  }

  const sign = value < 0 ? "-" : "";
  const absRaw = Math.abs(value);
  const eokValue = absRaw >= 100_000_000 ? absRaw / 100_000_000 : absRaw;

  const jo = Math.floor(eokValue / 10_000);
  const eok = Math.round(eokValue % 10_000);

  if (jo > 0 && eok > 0) {
    return `${sign}${formatNumber(jo)}조 ${formatCurrency(eok, "억원")}`;
  }

  if (jo > 0) {
    return `${sign}${formatNumber(jo)}조`;
  }

  return `${sign}${formatCurrency(eok, "억원")}`;
}

function formatPercent(value: NumericValue) {
  return formatPercentValue(value, 1);
}

function formatCompareTableValue(
  value: NumericValue,
  format: CompareValueFormat
) {
  if (format === "currency") {
    return formatKoreanMoney(value);
  }

  if (format === "percent") {
    return formatPercent(value);
  }

  return formatNumber(value);
}

function hasNumericValue(value: NumericValue): value is number {
  return isValidNumber(value);
}

function getValidChartValueCount(
  series: Array<{ values: Array<number | null> }>
) {
  return series.reduce(
    (count, item) =>
      count + item.values.filter((value) => hasNumericValue(value)).length,
    0
  );
}

function getValidBarValueCount(data: Array<Record<string, string | number | null>>) {
  return data.reduce(
    (count, row) =>
      count +
      Object.entries(row).filter(
        ([key, value]) =>
          key !== "label" &&
          typeof value === "number" &&
          hasNumericValue(value)
      ).length,
    0
  );
}

function getBestCompareValue(values: NumericValue[], higherIsBetter: boolean) {
  const numericValues = values.filter(hasNumericValue);

  if (numericValues.length < 2) return null;
  if (new Set(numericValues).size === 1) return null;

  return higherIsBetter
    ? Math.max(...numericValues)
    : Math.min(...numericValues);
}

function calculateGrowthRate(
  current: number | null | undefined,
  previous: number | null | undefined
) {
  return calculateFinancialGrowth(current, previous, { allowNegative: true });
}

function getMetricValue(
  history: YearlyDataApi[],
  key: "operating_margin" | "net_margin" | "revenue_growth_rate",
  fiscalYear: number
) {
  return getFinancialMetricValue(history, key, fiscalYear);
}

function getDebtRatio(item: YearlyDataApi | null) {
  return calculateDebtRatio(item);
}

function getRoe(item: YearlyDataApi | null) {
  return calculateROE(item);
}

function getRoa(item: YearlyDataApi | null) {
  return calculateROA(item);
}

function getEquityRatio(item: YearlyDataApi | null) {
  return calculateEquityRatio(item);
}

function sortHistory(history?: YearlyDataApi[]) {
  return sortFinancialHistory(history);
}

function getLatestThreeHistory(history: YearlyDataApi[]) {
  return pickLatestFinancialYears(history, 3);
}

function cleanCompareText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function getCompareCompanyKey(company: Pick<SelectedCompareCompany, "keyword" | "corpCode" | "stockCode" | "displayName" | "name">) {
  return (
    cleanCompareText(company.corpCode) ??
    cleanCompareText(company.stockCode) ??
    cleanCompareText(company.displayName) ??
    cleanCompareText(company.keyword) ??
    cleanCompareText(company.name) ??
    ""
  )
    .replace(/\s+/g, "")
    .toLowerCase();
}

function createSelectedCompanyFromQuery(
  keyword: string,
  displayName?: string
): SelectedCompareCompany {
  const normalizedKeyword = keyword.trim();
  const normalizedDisplayName =
    cleanCompareText(displayName) ?? normalizedKeyword;
  const stockCode = /^\d{6}$/.test(normalizedKeyword)
    ? normalizedKeyword
    : undefined;

  return {
    keyword: normalizedKeyword,
    stockCode,
    displayName: normalizedDisplayName,
    name: normalizedDisplayName,
  };
}

function createSelectedCompanyFromSearchItem(
  company: CompanySearchItem,
  fallbackKeyword: string
): SelectedCompareCompany {
  const target = toCompanyAnalysisTarget(company, fallbackKeyword);
  const name = getCompanyDisplayName(company) || target.displayName || target.keyword;

  return {
    ...target,
    name,
    market: cleanCompareText(company.market),
    sector: cleanCompareText(company.sector),
    industry: cleanCompareText(company.industry),
    business: cleanCompareText(company.business),
  };
}

function getRecommendedCompanyName(company: RecommendedCompanyApi) {
  return cleanCompareText(company.company_name) ?? "기업명 없음";
}

function createSelectedCompanyFromRecommendation(
  company: RecommendedCompanyApi
): SelectedCompareCompany {
  const name = getRecommendedCompanyName(company);
  const stockCode = cleanCompareText(company.stock_code);

  return {
    keyword: stockCode ?? name,
    stockCode,
    displayName: name,
    name,
    sector: cleanCompareText(company.sector),
  };
}

function isHealthyRecommendationStatus(value?: string | null) {
  return isPositiveFinancialStatus(value);
}

const FINANCIAL_STATUS_TEXT_PATTERN = new RegExp(
  `(${FINANCIAL_STATUS_TEXT_TERMS.join("|")})`,
  "g"
);

function renderFinancialStatusText(text: string) {
  return text.split(FINANCIAL_STATUS_TEXT_PATTERN).map((part, index) =>
    FINANCIAL_STATUS_TEXT_TERMS.includes(part) ? (
      <span
        key={`${part}-${index}`}
        className={`font-semibold ${getFinancialStatusTextClass(part)}`}
      >
        {part}
      </span>
    ) : (
      part
    )
  );
}

function getRecommendationStatusItems(company: RecommendedCompanyApi) {
  return [
    { label: "성장성", value: cleanCompareText(company.growth_status) },
    { label: "수익성", value: cleanCompareText(company.profitability_status) },
    { label: "안정성", value: cleanCompareText(company.stability_status) },
  ]
    .filter((item): item is { label: string; value: string } => !!item.value)
    .map((item) => ({
      ...item,
      isHealthy: isHealthyRecommendationStatus(item.value),
    }));
}

function getSelectedCompanyLabel(company: SelectedCompareCompany) {
  return company.displayName || company.name || company.keyword;
}

function getSelectedCompanyMeta(company: SelectedCompareCompany) {
  return [
    company.stockCode,
    company.market,
    company.sector || company.industry,
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildCompareUrl(companies: SelectedCompareCompany[]) {
  const params = new URLSearchParams();

  companies.forEach((company) => {
    params.append("company", company.stockCode ?? company.keyword);
    params.append("displayName", getSelectedCompanyLabel(company));
  });

  const query = params.toString();
  return query ? `/compare?${query}` : "/compare";
}

function buildSelectedCompareReport(companies: CompareCompanyData[]) {
  if (companies.length < MIN_COMPARE_SELECTION_COUNT) {
    return "비교하려면 최소 2개 기업이 필요합니다.";
  }

  if (companies.length === 2) {
    return buildCompareReport(
      companies[0].displayName,
      companies[1].displayName,
      companies[0].latest,
      companies[1].latest
    );
  }

  const companyNames = companies.map((company) => company.displayName).join(", ");
  const missingCompanies = companies
    .filter((company) => company.error || !company.latest)
    .map((company) => company.displayName);

  if (missingCompanies.length > 0) {
    return `${companyNames} 3개 기업을 비교합니다. 다만 ${missingCompanies.join(
      ", "
    )}의 일부 데이터가 부족해 확인 가능한 지표 위주로 비교합니다.`;
  }

  return `${companyNames} 3개 기업의 규모, 성장성, 수익성, 안정성 지표를 함께 비교합니다. 3개 기업 비교에서는 특정 기업을 단정적으로 평가하기보다 각 지표의 상대적 위치와 데이터 부족 여부를 함께 참고하는 것이 적절합니다.`;
}

function CompareBarCard({
  title,
  description,
  data,
  series,
  formatter,
}: CompareBarCardProps) {
  const validValueCount = getValidBarValueCount(data);

  return (
    <Box className="p-5">
      <SectionLabel>{title}</SectionLabel>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <div className="mt-4 h-[300px] w-full sm:h-[280px]">
        {validValueCount <= 1 ? (
          <StatusState
            variant="empty"
            title="차트 데이터가 부족합니다"
            description="비교 가능한 값이 충분하지 않습니다."
            compact
            className="flex h-full items-center"
          />
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 18, left: 8, bottom: 18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(value) => formatter(value)}
              tick={{ fontSize: 10, fill: "#64748b" }}
              width={58}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value) =>
                formatter(typeof value === "number" ? value : null)
              }
              labelFormatter={(label) => `${label}`}
              wrapperStyle={CHART_TOOLTIP_CONTAINER_STYLE}
              contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 11, lineHeight: "18px" }} />
            {series.map((item) => (
              <Bar
                key={item.name}
                dataKey={item.name}
                name={item.name}
                fill={item.color}
                radius={[8, 8, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </Box>
  );
}

function CompareMultiLineCard({
  title,
  description,
  labels,
  series,
  formatter,
}: CompareMultiLineCardProps) {
  const data = labels.map((label, index) => {
    const row: Record<string, string | number | null> = {
      year: label,
    };

    series.forEach((item) => {
      const value = item.values[index];
      row[item.name] = hasNumericValue(value) ? value : null;
    });

    return row;
  });
  const validValueCount = getValidChartValueCount(series);

  return (
    <Box className="p-5">
      <SectionLabel>{title}</SectionLabel>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <div className="mt-4 h-[300px] w-full sm:h-[280px]">
        {validValueCount <= 1 ? (
          <StatusState
            variant="empty"
            title="차트 데이터가 부족합니다"
            description="비교 가능한 연도별 값이 충분하지 않습니다."
            compact
            className="flex h-full items-center"
          />
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 18, left: 8, bottom: 18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              interval={0}
              minTickGap={8}
            />
            <YAxis
              tickFormatter={(value) => formatter(value)}
              tick={{ fontSize: 10, fill: "#64748b" }}
              width={58}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              filterNull={false}
              formatter={(value) =>
                formatter(typeof value === "number" ? value : null)
              }
              labelFormatter={(label) => `${label}년`}
              wrapperStyle={CHART_TOOLTIP_CONTAINER_STYLE}
              contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 11, lineHeight: "18px" }} />
            {series.map((item) => (
              <Line
                key={item.name}
                type="monotone"
                dataKey={item.name}
                name={item.name}
                stroke={item.color}
                strokeWidth={2}
                dot={{ r: 2, stroke: item.color, fill: item.color }}
                activeDot={{ r: 4, stroke: item.color, fill: item.color }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>
    </Box>
  );
}

function CompareCompanySelector({
  selectedCompanies,
  onAddCompany,
  onRemoveCompany,
  onClearCompanies,
  onStartCompare,
  canStartCompare,
}: {
  selectedCompanies: SelectedCompareCompany[];
  onAddCompany: (company: SelectedCompareCompany) => void;
  onRemoveCompany: (companyKey: string) => void;
  onClearCompanies: () => void;
  onStartCompare: () => void;
  canStartCompare: boolean;
}) {
  const {
    query,
    setQuery,
    normalizedQuery,
    status,
    isLoading,
    results,
    suggestions,
    errorMessage,
    hasUserInteracted,
    setHasUserInteracted,
    reset,
  } = useCompanySearch();
  const [recommendationStatus, setRecommendationStatus] =
    useState<RecommendationStatus>("idle");
  const [recommendedCompanies, setRecommendedCompanies] = useState<
    RecommendedCompanyApi[]
  >([]);
  const [recommendationErrorText, setRecommendationErrorText] = useState("");
  const selectedKeys = useMemo(
    () => new Set(selectedCompanies.map(getCompareCompanyKey)),
    [selectedCompanies]
  );
  const visibleResults = (results.length > 0 ? results : suggestions).slice(
    0,
    8
  );
  const trimmedQuery = normalizedQuery.collapsed;
  const isMaxSelected =
    selectedCompanies.length >= MAX_COMPARE_SELECTION_COUNT;
  const helperText = canStartCompare
    ? "선택한 기업으로 비교할 수 있습니다. 최대 3개까지 비교할 수 있습니다."
    : "비교하려면 최소 2개 기업이 필요합니다. 최대 3개까지 선택할 수 있습니다.";

  useEffect(() => {
    let isMounted = true;

    async function loadRecommendations() {
      try {
        setRecommendationStatus("loading");
        setRecommendationErrorText("");

        const response = await getRecommendedCompanies(RECOMMENDATION_LIMIT);

        if (!isMounted) return;

        setRecommendedCompanies(response);
        setRecommendationStatus(response.length > 0 ? "success" : "empty");
      } catch (error) {
        if (!isMounted) return;

        setRecommendedCompanies([]);
        setRecommendationStatus("error");
        setRecommendationErrorText(
          getUserFriendlyApiErrorMessage(
            error,
            "추천 후보를 불러오지 못했습니다."
          )
        );
      }
    }

    void loadRecommendations();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleSelectCompany(company: CompanySearchItem) {
    if (isMaxSelected) return;

    const selectedCompany = createSelectedCompanyFromSearchItem(
      company,
      trimmedQuery
    );

    if (selectedKeys.has(getCompareCompanyKey(selectedCompany))) return;

    onAddCompany(selectedCompany);
    setQuery("");
    reset();
  }

  function handleRecommendedCompany(company: RecommendedCompanyApi) {
    if (isMaxSelected) return;

    const selectedCompany = createSelectedCompanyFromRecommendation(company);

    if (selectedKeys.has(getCompareCompanyKey(selectedCompany))) return;

    onAddCompany(selectedCompany);
  }

  return (
    <Box className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>비교 대상 선택</SectionLabel>
          <p className="mt-2 text-sm text-slate-500">
            {selectedCompanies.length} / {MAX_COMPARE_SELECTION_COUNT}개 선택됨
          </p>
        </div>

        {selectedCompanies.length > 0 && (
          <Button
            type="button"
            onClick={onClearCompanies}
            variant="outline"
            size="md"
            className="text-slate-600"
          >
            <RotateCcw className="h-4 w-4" />
            전체 초기화
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {selectedCompanies.length > 0 ? (
          selectedCompanies.map((company) => {
            const companyKey = getCompareCompanyKey(company);

            return (
              <CompanyChip
                key={companyKey}
                className="w-full justify-between gap-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900">
                    {getSelectedCompanyLabel(company)}
                  </span>
                  {getSelectedCompanyMeta(company) && (
                    <span className="block truncate text-xs text-slate-500">
                      {getSelectedCompanyMeta(company)}
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  onClick={() => onRemoveCompany(companyKey)}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-slate-400 hover:bg-white"
                  aria-label={`${getSelectedCompanyLabel(company)} 제거`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CompanyChip>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 sm:col-span-2 lg:col-span-3">
            아직 선택된 기업이 없습니다.
          </div>
        )}
      </div>

      <InnerSurface className="mt-4">
        <div className="flex items-center gap-3 rounded-lg border border-sky-200 bg-white px-4 py-3 transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
          <Search className="h-5 w-5 shrink-0 text-sky-500" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHasUserInteracted(true);
            }}
            onFocus={() => setHasUserInteracted(true)}
            placeholder="기업명 또는 종목코드를 검색하세요"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          {isLoading && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
          )}
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-sky-100 bg-white">
          {!trimmedQuery && (
            <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">
                    우량주 비교 후보
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    최근 수집 데이터 기준으로 성장성, 수익성, 안정성 중 건강한 지표가 많은 기업입니다.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                  건강 지표 기준
                </span>
              </div>

              {recommendationStatus === "loading" && (
                <div className="mt-3">
                  <StatusState
                    compact
                    variant="loading"
                    title="추천 후보를 불러오는 중입니다."
                  />
                </div>
              )}

              {recommendationStatus === "empty" && (
                <div className="mt-3">
                  <StatusState
                    compact
                    variant="empty"
                    title="추천할 비교 후보가 없습니다."
                  />
                </div>
              )}

              {recommendationStatus === "error" && (
                <div className="mt-3">
                  <StatusState
                    compact
                    variant="warning"
                    title="추천 후보를 불러오지 못했습니다."
                    description={recommendationErrorText}
                  />
                </div>
              )}

              {recommendationStatus === "success" && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {recommendedCompanies.map((company, index) => {
                    const selectedCompany =
                      createSelectedCompanyFromRecommendation(company);
                    const companyKey = getCompareCompanyKey(selectedCompany);
                    const isSelected = selectedKeys.has(companyKey);
                    const healthyCount =
                      typeof company.healthy_count === "number" &&
                      Number.isFinite(company.healthy_count)
                        ? company.healthy_count
                        : null;
                    const statusItems = getRecommendationStatusItems(company);

                    return (
                      <div
                        key={`${company.stock_code ?? company.company_name ?? index}`}
                        className="flex min-w-0 max-w-full flex-col overflow-hidden rounded-lg border border-sky-100 bg-slate-50 px-3 py-3"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                            {getRecommendedCompanyName(company)}
                          </p>
                          {healthyCount !== null && (
                            <StatusBadge
                              tone="success"
                              className="shrink-0 whitespace-nowrap"
                            >
                              건강 지표 {healthyCount}개
                            </StatusBadge>
                          )}
                        </div>

                        <p className="mt-1 min-w-0 max-w-full truncate text-xs text-slate-500">
                          {cleanCompareText(company.sector) || "섹터 정보 확인 중"}
                        </p>

                        {statusItems.length > 0 && (
                          <div className="mt-2 flex min-w-0 max-w-full flex-wrap gap-1.5">
                            {statusItems.map((item) => (
                              <span
                                key={item.label}
                                className={`rounded-md border px-2 py-1 text-xs ${
                                  item.isHealthy ? "font-semibold" : "font-medium"
                                } ${getFinancialStatusChipClass(item.value)}`}
                              >
                                {item.label} {item.value}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex justify-end">
                          <Button
                            type="button"
                            onClick={() => handleRecommendedCompany(company)}
                            disabled={isSelected || isMaxSelected}
                            variant="outline"
                            size="sm"
                            className="whitespace-nowrap bg-white disabled:opacity-50"
                          >
                            {isSelected ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                추가됨
                              </>
                            ) : isMaxSelected ? (
                              "최대 3개"
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5" />
                                비교에 추가
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {trimmedQuery && status === "loading" && (
            <div className="p-4">
              <StatusState
                compact
                variant="loading"
                title="검색 결과를 불러오는 중입니다."
              />
            </div>
          )}

          {trimmedQuery && status === "error" && (
            <div className="p-4">
              <StatusState
                compact
                variant="error"
                title={errorMessage || "검색 결과를 불러오지 못했습니다."}
              />
            </div>
          )}

          {trimmedQuery && status === "empty" && (
            <div className="p-4">
              <StatusState
                compact
                variant="empty"
                title="검색 결과가 없습니다."
                description="기업명 또는 종목코드를 다시 확인해주세요."
              />
            </div>
          )}

          {trimmedQuery &&
            hasUserInteracted &&
            visibleResults.map((company, index) => {
              const selectedCompany = createSelectedCompanyFromSearchItem(
                company,
                trimmedQuery
              );
              const companyKey = getCompareCompanyKey(selectedCompany);
              const isSelected = selectedKeys.has(companyKey);
              const meta = [
                company.stockCode,
                company.market,
                company.sector || company.industry,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <button
                  key={`${company.name}-${company.stockCode ?? company.corpCode ?? index}`}
                  type="button"
                  onClick={() => handleSelectCompany(company)}
                  disabled={isSelected || isMaxSelected}
                  className="flex min-h-16 w-full items-center justify-between gap-3 border-t border-sky-50 px-4 py-3 text-left transition first:border-t-0 hover:bg-sky-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {getCompanyDisplayName(company)}
                    </span>
                    {meta && (
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        {meta}
                      </span>
                    )}
                    {company.business && (
                      <span className="mt-1 line-clamp-1 text-xs text-slate-400">
                        {company.business}
                      </span>
                    )}
                  </span>
                  <StatusBadge tone={isSelected ? "success" : "neutral"}>
                    {isSelected ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        선택됨
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        추가
                      </>
                    )}
                  </StatusBadge>
                </button>
              );
            })}
        </div>
      </InnerSurface>

      <div className="mt-4 rounded-lg border border-sky-100 bg-white p-3 shadow-sm shadow-sky-100/50 md:bg-transparent md:p-0 md:shadow-none">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500">{helperText}</p>
          <Button
            type="button"
            onClick={onStartCompare}
            disabled={!canStartCompare}
            size="lg"
          >
            비교분석 시작
          </Button>
        </div>
      </div>
    </Box>
  );
}

type ComparePageContentProps = {
  initialCompanyNames?: string[];
  initialCompanyData?: CompanySummaryApiResponse[];
  isPublicShare?: boolean;
};

export function ComparePageContent({
  initialCompanyNames,
  initialCompanyData,
  isPublicShare = false,
}: ComparePageContentProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    setBackendStatus,
    setDataSource,
    setIsRunningAnalysis,
  } = useDataSource();
  const { plan } = useMockAuth();
  const canAccessCompare = canUseFeature(plan, "companyCompare");
  const companyParams = searchParams
    .getAll("company")
    .map(normalizeCompareQueryValue);
  const companyParamsKey = companyParams.join("\n");
  const displayNameParams = searchParams
    .getAll("displayName")
    .map(normalizeCompareQueryValue);
  const displayNameParamsKey = displayNameParams.join("\n");
  const company1Param = normalizeCompareQueryValue(
    searchParams.get("company1")
  );
  const company2Param = normalizeCompareQueryValue(
    searchParams.get("company2")
  );
  const company3Param = normalizeCompareQueryValue(
    searchParams.get("company3")
  );

  const initialSelectedCompanies = useMemo(() => {
    if (initialCompanyNames) {
      const seen = new Set<string>();

      return initialCompanyNames
        .map(normalizeCompareQueryValue)
        .filter(Boolean)
        .map((name) => createSelectedCompanyFromQuery(name))
        .filter((company) => {
          const key = getCompareCompanyKey(company);

          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, MAX_COMPARE_SELECTION_COUNT);
    }

    const companiesFromQuery = companyParamsKey
      ? companyParamsKey.split("\n").filter(Boolean)
      : [];
    const displayNamesFromQuery = displayNameParamsKey
      ? displayNameParamsKey.split("\n")
      : [];
    const candidates = [
      ...companiesFromQuery.map((company, index) =>
        createSelectedCompanyFromQuery(
          company,
          displayNamesFromQuery[index]
        )
      ),
      ...[company1Param, company2Param, company3Param]
        .filter(Boolean)
        .map((company) => createSelectedCompanyFromQuery(company)),
    ];
    const seen = new Set<string>();

    return candidates
      .filter((company) => {
        const key = getCompareCompanyKey(company);

        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_COMPARE_SELECTION_COUNT);
  }, [
    company1Param,
    company2Param,
    company3Param,
    companyParamsKey,
    displayNameParamsKey,
    initialCompanyNames,
  ]);

  const [selectedCompanies, setSelectedCompanies] = useState<
    SelectedCompareCompany[]
  >(initialSelectedCompanies);
  const initialResults = useMemo<CompanyFetchResult[]>(
    () =>
      (initialCompanyData ?? []).map((data) => ({
        company: data.company_name || data.stock_code,
        data,
      })),
    [initialCompanyData]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CompanyFetchResult[]>(initialResults);
  const [loadError, setLoadError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareExpiresAt, setShareExpiresAt] = useState("");
  const [shareError, setShareError] = useState("");
  const [isSavingShare, setIsSavingShare] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);
  const compareRequestIdRef = useRef(0);

  useEffect(() => {
    setSelectedCompanies(initialSelectedCompanies);
  }, [initialSelectedCompanies]);

  useEffect(() => {
    setShareUrl("");
    setShareExpiresAt("");
    setShareError("");
    setIsShareCopied(false);
  }, [selectedCompanies]);

  const canStartCompare =
    selectedCompanies.length >= MIN_COMPARE_SELECTION_COUNT;
  const showResultView = canAccessCompare && canStartCompare;

  useEffect(() => {
    let isMounted = true;
    const requestId = compareRequestIdRef.current + 1;
    compareRequestIdRef.current = requestId;

    async function fetchCompareSummaries() {
      if (!showResultView) {
        setResults([]);
        setLoadError("");
        setIsLoading(false);
        setDataSource("none");
        setBackendStatus("idle");
        setIsRunningAnalysis(false);
        return;
      }

      if (
        initialResults.length >= MIN_COMPARE_SELECTION_COUNT &&
        selectedCompanies.length === initialResults.length &&
        selectedCompanies.every((company, index) => {
          const initialResult = initialResults[index];
          return (
            isDataResult(initialResult) &&
            getCompareCompanyKey(company) ===
              (initialResult.data.stock_code || initialResult.data.company_name)
          );
        })
      ) {
        setResults(initialResults);
        setLoadError("");
        setIsLoading(false);
        setDataSource("api");
        setBackendStatus("success");
        setIsRunningAnalysis(false);
        return;
      }

      try {
        setIsLoading(true);
        setLoadError("");
        setDataSource("none");
        setBackendStatus("requesting");
        setIsRunningAnalysis(true);

        const companies = selectedCompanies.map((company) => ({
          label: getSelectedCompanyLabel(company),
          target: {
            keyword: company.keyword,
            corpCode: company.corpCode,
            stockCode: company.stockCode,
            displayName: company.displayName,
          },
        }));
        const settled = await Promise.allSettled(
          companies.map(async (company) => {
            const data = await getSummary(company.target, "억");
            return {
              company: company.label,
              data,
            } satisfies CompanyFetchResult;
          })
        );

        if (!isMounted || requestId !== compareRequestIdRef.current) return;

        const nextResults = settled.map((item, index) => {
          const company = companies[index]?.label ?? "기업";

          if (item.status === "fulfilled") {
            return item.value;
          }

          return {
            company,
            error:
              getUserFriendlyApiErrorMessage(
                item.reason,
                "일부 비교 데이터가 제공되지 않습니다."
              ),
          } satisfies CompanyFetchResult;
        });

        setResults(nextResults);

        if (nextResults.every(isErrorResult)) {
          setLoadError("선택한 기업의 비교 데이터를 불러오지 못했습니다.");
          setDataSource("none");
          setBackendStatus("failed");
          return;
        }

        const dataResults = nextResults.filter(isDataResult);
        const mockResult = dataResults.find(
          (result) => result.data.__dataSource === "mock"
        );

        if (mockResult) {
          setDataSource("mock");
          setBackendStatus("fallback-mock");
        } else {
          const hasPartialApiResult = dataResults.some(
            (result) => result.data.__dataSource === "api-partial"
          );

          setDataSource(hasPartialApiResult ? "api-partial" : "api");
          setBackendStatus("success");
        }
      } catch (error) {
        if (!isMounted || requestId !== compareRequestIdRef.current) return;

        setLoadError(
          getUserFriendlyApiErrorMessage(
            error,
            "비교 데이터를 불러오지 못했습니다."
          )
        );
        setDataSource("none");
        setBackendStatus("failed");
      } finally {
        if (isMounted && requestId === compareRequestIdRef.current) {
          setIsLoading(false);
          setIsRunningAnalysis(false);
        }
      }
    }

    void fetchCompareSummaries();

    return () => {
      isMounted = false;
    };
  }, [
    initialResults,
    selectedCompanies,
    setBackendStatus,
    setDataSource,
    setIsRunningAnalysis,
    showResultView,
  ]);

  const compareCompanies = useMemo<CompareCompanyData[]>(() => {
    return results.map((result) => {
      const data = isDataResult(result) ? result.data : null;
      const error = isErrorResult(result) ? result.error : undefined;
      const history = sortHistory(data?.history);
      const latest = history.length > 0 ? history[history.length - 1] : null;

      return {
        inputName: result.company,
        displayName: data?.company_name ?? result.company,
        stockCode: data?.stock_code ?? "-",
        history,
        latest,
        summaryText: data?.summary_text ?? "",
        summaryLines: data
          ? buildThreeLineFinancialSummary(data.company_name, history, {
              growth: data.growth_status,
              stability: data.stability_status,
              profitability: data.profitability_status,
            })
          : [],
        error,
      };
    });
  }, [results]);
  const selectedCompaniesForDisplay = useMemo(
    () =>
      selectedCompanies.map((company, index) => {
        const result = results[index];
        const resolvedName =
          result && isDataResult(result)
            ? cleanCompareText(result.data.company_name)
            : undefined;

        if (!resolvedName) return company;

        return {
          ...company,
          displayName: resolvedName,
          name: resolvedName,
        };
      }),
    [results, selectedCompanies]
  );

  const chartCompanies = compareCompanies.slice(0, MAX_COMPARE_SELECTION_COUNT);
  const compareSeries = chartCompanies.map((company, index) => ({
    name: company.displayName,
    color: COMPARE_CHART_COLORS[index] ?? COMPARE_CHART_COLORS[0],
  }));

  const compareTitle = useMemo(() => {
    if (compareCompanies.length >= MIN_COMPARE_SELECTION_COUNT) {
      return compareCompanies
        .slice(0, MAX_COMPARE_SELECTION_COUNT)
        .map((company) => company.displayName)
        .join(" vs ");
    }

    const selectedLabels = selectedCompanies
      .slice(0, MAX_COMPARE_SELECTION_COUNT)
      .map(getSelectedCompanyLabel);
    return selectedLabels.length >= 2 ? selectedLabels.join(" vs ") : "";
  }, [compareCompanies, selectedCompanies]);

  const shareKeywords = useMemo(() => {
    const selectedByLabel = new Map(
      selectedCompanies.map((company) => [
        getSelectedCompanyLabel(company).replace(/\s+/g, "").toLowerCase(),
        company,
      ])
    );

    return chartCompanies
      .map((company) => {
        const selected = selectedByLabel.get(
          company.inputName.replace(/\s+/g, "").toLowerCase()
        );
        const stockCode = company.stockCode === "-" ? "" : company.stockCode;

        return stockCode || selected?.stockCode || selected?.keyword || "";
      })
      .filter(Boolean)
      .slice(0, MAX_COMPARE_SELECTION_COUNT);
  }, [chartCompanies, selectedCompanies]);

  const canCreateShareLink =
    shareKeywords.length >= MIN_COMPARE_SELECTION_COUNT && !isLoading;

  const chartYears = useMemo(() => {
    const yearSet = new Set<number>();

    chartCompanies.forEach((company) => {
      getLatestThreeHistory(company.history).forEach((item) => {
        yearSet.add(item.fiscal_year);
      });
    });

    return [...yearSet].sort((a, b) => a - b).map(String);
  }, [chartCompanies]);

  const growthSeries = useMemo(
    () =>
      chartCompanies.map((company, index) => ({
        name: company.displayName,
        color: COMPARE_CHART_COLORS[index] ?? COMPARE_CHART_COLORS[0],
        values: chartYears.map((year) =>
          getMetricValue(company.history, "revenue_growth_rate", Number(year))
        ),
      })),
    [chartCompanies, chartYears]
  );

  const profitabilitySeries = useMemo(
    () =>
      chartCompanies.flatMap((company, index) => {
        const baseColor = COMPARE_CHART_COLORS[index] ?? COMPARE_CHART_COLORS[0];
        const secondaryColor =
          SECONDARY_SERIES_COLORS[index] ?? SECONDARY_SERIES_COLORS[0];

        return [
          {
            name: `${company.displayName} 영업이익률`,
            color: baseColor,
            values: chartYears.map((year) =>
              getMetricValue(company.history, "operating_margin", Number(year))
            ),
          },
          {
            name: `${company.displayName} 순이익률`,
            color: secondaryColor,
            values: chartYears.map((year) =>
              getMetricValue(company.history, "net_margin", Number(year))
            ),
          },
        ];
      }),
    [chartCompanies, chartYears]
  );

  const sizeBarData = useMemo(() => {
    return [
      {
        label: "매출",
        ...Object.fromEntries(
          chartCompanies.map((company) => [
            company.displayName,
            company.latest?.revenue ?? null,
          ])
        ),
      },
      {
        label: "자산",
        ...Object.fromEntries(
          chartCompanies.map((company) => [
            company.displayName,
            company.latest?.total_assets ?? null,
          ])
        ),
      },
      {
        label: "현금",
        ...Object.fromEntries(
          chartCompanies.map((company) => [
            company.displayName,
            company.latest?.cash ?? null,
          ])
        ),
      },
    ];
  }, [chartCompanies]);

  const stabilityBarData = useMemo(() => {
    return [
      {
        label: "부채비율",
        ...Object.fromEntries(
          chartCompanies.map((company) => [
            company.displayName,
            getDebtRatio(company.latest),
          ])
        ),
      },
      {
        label: "자본비율",
        ...Object.fromEntries(
          chartCompanies.map((company) => [
            company.displayName,
            getEquityRatio(company.latest),
          ])
        ),
      },
    ];
  }, [chartCompanies]);

  const companyMetricCards = useMemo(() => {
    return compareCompanies.map((company) => {
      const latestOperatingMargin = getMetricValue(
        company.history,
        "operating_margin",
        company.latest?.fiscal_year ?? 0
      );
      const latestNetMargin = getMetricValue(
        company.history,
        "net_margin",
        company.latest?.fiscal_year ?? 0
      );
      const debtRatio = getDebtRatio(company.latest);

      return {
        name: company.displayName,
        stockCode: company.stockCode || "-",
        error: company.error,
        metrics: [
          {
            label: "매출액",
            value: formatKoreanMoney(company.latest?.revenue),
          },
          {
            label: "영업이익",
            value: formatKoreanMoney(company.latest?.operating_profit),
          },
          {
            label: "당기순이익",
            value: formatKoreanMoney(company.latest?.net_income),
          },
          {
            label: "영업이익률",
            value: formatPercent(latestOperatingMargin),
          },
          {
            label: "순이익률",
            value: formatPercent(latestNetMargin),
          },
          {
            label: "부채비율",
            value: formatPercent(debtRatio),
          },
        ],
      };
    });
  }, [compareCompanies]);

  const compareTableGroups = useMemo<CompareTableGroup[]>(() => {
    if (chartCompanies.length < MIN_COMPARE_SELECTION_COUNT) return [];

    const groups: Array<{
      title: string;
      description: string;
      metrics: ComparisonRowConfig[];
    }> = [
      {
        title: "성장성",
        description: "매출과 이익의 성장 흐름을 비교합니다.",
        metrics: [
          {
            label: "매출액",
            format: "currency",
            description: getComparePoint("매출액"),
            higherIsBetter: true,
            getValue: (company) => company.latest?.revenue,
          },
          {
            label: "영업이익",
            format: "currency",
            description: getComparePoint("영업이익"),
            higherIsBetter: true,
            getValue: (company) => company.latest?.operating_profit,
          },
          {
            label: "당기순이익",
            format: "currency",
            description: getComparePoint("당기순이익"),
            higherIsBetter: true,
            getValue: (company) => company.latest?.net_income,
          },
          {
            label: "매출성장률",
            format: "percent",
            description: getComparePoint("매출성장률"),
            higherIsBetter: true,
            getValue: (company) =>
              getMetricValue(
                company.history,
                "revenue_growth_rate",
                company.latest?.fiscal_year ?? 0
              ),
          },
          {
            label: "영업이익성장률",
            format: "percent",
            description: getComparePoint("영업이익성장률"),
            higherIsBetter: true,
            getValue: (company) =>
              calculateGrowthRate(
                company.latest?.operating_profit,
                company.history.at(-2)?.operating_profit
              ),
          },
          {
            label: "순이익성장률",
            format: "percent",
            description: getComparePoint("순이익성장률"),
            higherIsBetter: true,
            getValue: (company) =>
              calculateGrowthRate(
                company.latest?.net_income,
                company.history.at(-2)?.net_income
              ),
          },
        ],
      },
      {
        title: "수익성",
        description: "이익률과 자산·자본 대비 수익성을 비교합니다.",
        metrics: [
          {
            label: "영업이익률",
            format: "percent",
            description: getComparePoint("영업이익률"),
            higherIsBetter: true,
            getValue: (company) =>
              getMetricValue(
                company.history,
                "operating_margin",
                company.latest?.fiscal_year ?? 0
              ),
          },
          {
            label: "순이익률",
            format: "percent",
            description: getComparePoint("순이익률"),
            higherIsBetter: true,
            getValue: (company) =>
              getMetricValue(
                company.history,
                "net_margin",
                company.latest?.fiscal_year ?? 0
              ),
          },
          {
            label: "ROE",
            format: "percent",
            description: getComparePoint("ROE"),
            higherIsBetter: true,
            getValue: (company) => getRoe(company.latest),
          },
          {
            label: "ROA",
            format: "percent",
            description: getComparePoint("ROA"),
            higherIsBetter: true,
            getValue: (company) => getRoa(company.latest),
          },
        ],
      },
      {
        title: "안정성",
        description: "재무 구조와 자본 안정성을 비교합니다.",
        metrics: [
          {
            label: "부채비율",
            format: "percent",
            description: getComparePoint("부채비율"),
            higherIsBetter: false,
            getValue: (company) => getDebtRatio(company.latest),
          },
          {
            label: "자기자본비율",
            format: "percent",
            description: getComparePoint("자기자본비율"),
            higherIsBetter: true,
            getValue: (company) => getEquityRatio(company.latest),
          },
          {
            label: "자산총계",
            format: "currency",
            description: getComparePoint("자산총계"),
            higherIsBetter: true,
            getValue: (company) => company.latest?.total_assets,
          },
          {
            label: "부채총계",
            format: "currency",
            description: getComparePoint("부채총계"),
            higherIsBetter: false,
            getValue: (company) => company.latest?.total_liabilities,
          },
          {
            label: "자본총계",
            format: "currency",
            description: getComparePoint("자본총계"),
            higherIsBetter: true,
            getValue: (company) => company.latest?.equity,
          },
        ],
      },
    ];

    return groups
      .map((group) => ({
        title: group.title,
        description: group.description,
        rows: group.metrics
          .map((row) => {
            const rawValues = chartCompanies.map(row.getValue);
            const bestValue = getBestCompareValue(
              rawValues,
              row.higherIsBetter
            );

            return {
              label: row.label,
              point: row.description,
              higherIsBetter: row.higherIsBetter,
              values: chartCompanies.map((company, index) => {
                const rawValue = rawValues[index];

                return {
                  companyName: company.displayName,
                  rawValue,
                  value: formatCompareTableValue(rawValue, row.format),
                  isBest:
                    bestValue !== null &&
                    hasNumericValue(rawValue) &&
                    rawValue === bestValue,
                };
              }),
            };
          })
          .filter(
            (row) =>
              row.values.some((value) => hasNumericValue(value.rawValue))
          ),
      }))
      .filter((group) => group.rows.length > 0);
  }, [chartCompanies]);

  const perspectiveCards = buildPerspectiveCards();
  const metricCardGridClassName =
    companyMetricCards.length >= 3
      ? "mt-4 grid w-full grid-cols-1 gap-4 lg:grid-cols-3"
      : companyMetricCards.length === 2
        ? "mt-4 grid w-full grid-cols-1 gap-4 lg:grid-cols-2"
        : "mt-4 grid w-full grid-cols-1 gap-4";
  const compareTableClassName =
    chartCompanies.length >= 3
      ? "w-full min-w-[860px] table-fixed"
      : "w-full min-w-[640px] table-fixed";

  function handleAddCompany(company: SelectedCompareCompany) {
    setSelectedCompanies((prev) => {
      if (prev.length >= MAX_COMPARE_SELECTION_COUNT) return prev;

      const nextKey = getCompareCompanyKey(company);
      if (prev.some((item) => getCompareCompanyKey(item) === nextKey)) {
        return prev;
      }

      return [...prev, company];
    });
  }

  function handleRemoveCompany(companyKey: string) {
    const nextCompanies = selectedCompanies.filter(
      (company) => getCompareCompanyKey(company) !== companyKey
    );

    setSelectedCompanies(nextCompanies);
    router.replace(buildCompareUrl(nextCompanies), { scroll: false });
  }

  function handleClearCompanies() {
    setSelectedCompanies([]);
    setResults([]);
    setLoadError("");
    router.replace("/compare", { scroll: false });
  }

  function handleStartCompare() {
    if (!canStartCompare) return;
    router.push(buildCompareUrl(selectedCompaniesForDisplay));
  }

  async function handleCreateShareLink() {
    if (!canCreateShareLink) return;

    try {
      setIsSavingShare(true);
      setShareError("");
      setShareExpiresAt("");
      setIsShareCopied(false);

      const response = await createCompareShareLink(shareKeywords, "원");
      const origin =
        typeof window === "undefined" ? "" : window.location.origin;
      setShareUrl(`${origin}/compare/share/${response.share_id}`);
      setShareExpiresAt(response.expires_at);
    } catch (error) {
      setShareError(
        getUserFriendlyApiErrorMessage(
          error,
          "공유 링크를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요."
        )
      );
    } finally {
      setIsSavingShare(false);
    }
  }

  async function handleCopyShareLink() {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsShareCopied(true);
    } catch {
      setShareError("브라우저에서 자동 복사를 지원하지 않습니다. 링크를 직접 복사해 주세요.");
    }
  }

  return (
    <PageFrame
      title="기업 비교"
      description="최대 3개 기업의 재무 흐름과 핵심 지표를 나란히 살펴보며, 기업별 흐름과 분위기를 쉽게 비교해보세요."
      icon={ArrowRightLeft}
    >
      <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-[230px_minmax(820px,1fr)]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <RelatedCompanyList title="최근 본 기업" />
        </div>

        <div className="min-w-0 space-y-5">
          {!canAccessCompare ? (
            <FeatureLockedCard
              title="기업 비교 이용 안내"
              description="기업 비교는 로그인 후 이용할 수 있습니다."
            />
          ) : (
            <>
              {!isPublicShare && (
                <CompareCompanySelector
                  selectedCompanies={selectedCompaniesForDisplay}
                  onAddCompany={handleAddCompany}
                  onRemoveCompany={handleRemoveCompany}
                  onClearCompanies={handleClearCompanies}
                  onStartCompare={handleStartCompare}
                  canStartCompare={canStartCompare}
                />
              )}

              {!showResultView && (
                <Box className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <SectionLabel>공유 링크</SectionLabel>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        2개 이상의 기업을 비교하면 공유 링크를 만들 수
                        있어요.
                      </p>
                    </div>
                    <Button type="button" variant="outline" disabled>
                      <Share2 className="h-4 w-4" />
                      공유 링크 만들기
                    </Button>
                  </div>
                </Box>
              )}

              {!showResultView && (
                <Box className="p-6">
                  <StatusState
                    variant="info"
                    title="비교할 기업을 선택해주세요"
                    description="2개 이상의 기업을 선택하면 비교 결과를 확인할 수 있습니다."
                  />
                </Box>
              )}

              {showResultView && (
                <>
              <Box className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <SectionLabel>비교 대상</SectionLabel>
                    <p className="mt-3 text-lg font-semibold text-slate-900">
                      {compareTitle}
                    </p>
                  </div>

                  <p className="text-sm text-slate-500">
                    선택한 {chartCompanies.length}개 기업을 비교합니다.
                  </p>
                </div>
              </Box>

              {!isPublicShare && <Box className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <SectionLabel>공유 링크</SectionLabel>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      현재 비교 조합을 저장하고 공유용 URL을 생성합니다.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCreateShareLink}
                    disabled={!canCreateShareLink || isSavingShare}
                  >
                    {isSavingShare ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Share2 className="h-4 w-4" />
                    )}
                    공유 링크 만들기
                  </Button>
                </div>

                {!canCreateShareLink && (
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    2개 이상의 기업을 비교하면 공유 링크를 만들 수 있어요.
                  </p>
                )}

                {shareUrl && (
                  <div className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                    <code className="min-w-0 flex-1 break-all text-xs leading-5 text-slate-700">
                      {shareUrl}
                    </code>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyShareLink}
                    >
                      <Copy className="h-4 w-4" />
                      {isShareCopied ? "복사됨" : "복사"}
                    </Button>
                  </div>
                )}

                {shareExpiresAt && formatCompareShareExpiry(shareExpiresAt) && (
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 링크는 {formatCompareShareExpiry(shareExpiresAt)}까지
                    사용할 수 있어요.
                  </p>
                )}

                {isShareCopied && (
                  <p className="mt-2 text-sm leading-6 text-emerald-700">
                    복사 완료
                  </p>
                )}

                {shareError && (
                  <p className="mt-3 text-sm leading-6 text-red-600">
                    {shareError}
                  </p>
                )}
              </Box>}

              {!!companyMetricCards.length && (
                <Box className="p-5">
                  <SectionLabel>기업별 핵심 지표</SectionLabel>
                  <p className="mt-2 text-sm text-slate-500">
                    현재 비교 지표는 매출, 이익, 수익성, 안정성처럼
                    재무제표 기반으로 계산 가능한 항목만 표시합니다.
                  </p>
                  <div className={metricCardGridClassName}>
                    {companyMetricCards.map((company) => (
                      <div
                        key={company.name}
                        className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4"
                      >
                        <div>
                          <div className="break-keep text-base font-semibold leading-6 text-slate-900">
                            {company.name}
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-500">
                            {company.stockCode}
                          </div>
                        </div>

                        {company.error ? (
                          <p className="mt-4 text-sm leading-6 text-red-600">
                            {company.error}
                          </p>
                        ) : (
                          <dl className="mt-4 grid grid-cols-2 gap-2.5">
                            {company.metrics.map((metric) => (
                              <div
                                key={`${company.name}-${metric.label}`}
                                className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                              >
                                <dt className="truncate text-xs text-slate-500">
                                  {metric.label}
                                </dt>
                                <dd className="mt-1 break-keep text-sm font-semibold leading-5 text-slate-900">
                                  {metric.value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    ))}
                  </div>
                </Box>
              )}

              <Box className="p-5">
                <SectionLabel>재무제표 기반 비교 요약</SectionLabel>
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-700">
                  {buildSelectedCompareReport(chartCompanies)}
                </div>
              </Box>

              <AiReportSlot
                title="AI 비교 리포트 안내"
                description="여러 기업을 함께 분석하는 AI 리포트는 제공 예정입니다. 현재는 재무제표 기반 비교 결과를 확인해 주세요."
              />

              <div className="grid gap-4 md:grid-cols-2">
                {perspectiveCards.map((card) => (
                  <Box key={card.title} className="p-5 md:p-6">
                    <SectionLabel>{card.title}</SectionLabel>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {card.content}
                    </p>
                  </Box>
                ))}
              </div>

              <Box className="p-5">
                <SectionLabel>핵심 비교 테이블</SectionLabel>
                <div className="mt-4 w-full space-y-5">
                  {compareTableGroups.map((group) => (
                    <div key={group.title}>
                      <div className="mb-3">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {group.title}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {group.description}
                        </p>
                      </div>

                      <TableFrame
                        className="w-full"
                        ariaLabel={`${group.title} 기업 비교 테이블`}
                        caption={`${group.title} 지표별 기업 비교, 데이터가 없는 값은 -로 표시`}
                        tableClassName={compareTableClassName}
                      >
                          <colgroup>
                            <col className="w-[200px]" />
                            {chartCompanies.map((company) => (
                              <col
                                key={`${group.title}-${company.displayName}-col`}
                              />
                            ))}
                          </colgroup>
                          <thead className="bg-slate-50 text-slate-700">
                            <tr>
                              <th
                                scope="col"
                                className="sticky left-0 z-10 w-[200px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold"
                              >
                                항목
                              </th>
                              {chartCompanies.map((company) => (
                                <th
                                  key={`${group.title}-${company.displayName}`}
                                  scope="col"
                                  className="border-b border-slate-200 px-4 py-3 text-center font-semibold"
                                >
                                  <span className="block break-keep leading-5">
                                    {company.displayName}
                                  </span>
                                  {company.stockCode && (
                                    <span className="mt-1 block text-xs font-medium text-slate-500">
                                      {company.stockCode}
                                    </span>
                                  )}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row) => {
                              const tooltipId = `compare-tooltip-${group.title}-${row.label}`;
                              return (
                                <tr
                                  key={`${group.title}-${row.label}`}
                                  className="bg-white text-slate-700"
                                >
                                  <th
                                    scope="row"
                                    className="sticky left-0 z-10 w-[200px] border-b border-slate-100 bg-white px-4 py-3 text-left font-medium"
                                  >
                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                      <span className="min-w-0 truncate">
                                        {row.label}
                                      </span>
                                      <span className="group relative inline-flex shrink-0">
                                        <button
                                          type="button"
                                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-sky-100 bg-white text-slate-400 transition hover:border-sky-200 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                          aria-label={`${row.label} 지표 설명`}
                                          aria-describedby={tooltipId}
                                        >
                                          <HelpCircle className="h-3.5 w-3.5" />
                                        </button>
                                        <span
                                          id={tooltipId}
                                          role="tooltip"
                                          className="pointer-events-none absolute bottom-full left-0 z-[70] mb-3 hidden w-64 max-w-[calc(100vw-3rem)] whitespace-normal break-keep rounded-lg border border-sky-100 bg-white p-3 text-xs font-normal leading-relaxed text-slate-600 shadow-xl shadow-slate-200/80 group-hover:block group-focus-within:block"
                                        >
                                          {row.point}
                                        </span>
                                      </span>
                                    </div>
                                  </th>
                                  {row.values.map((value) => (
                                    <td
                                      key={`${group.title}-${row.label}-${value.companyName}`}
                                      className="border-b border-slate-100 px-4 py-3 text-right align-middle"
                                    >
                                      <span
                                        className={
                                          value.isBest
                                            ? "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700"
                                            : "inline-block max-w-full whitespace-nowrap"
                                        }
                                      >
                                        {value.value}
                                        {value.isBest && (
                                          <span className="text-[10px]">
                                            우위
                                          </span>
                                        )}
                                      </span>
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                      </TableFrame>
                    </div>
                  ))}
                </div>
              </Box>

              <Box className="p-5">
                <SectionLabel>관점별 그래프 섹션</SectionLabel>
                <p className="mt-2 text-sm text-slate-500">
                  금액 지표와 비율 지표를 분리해, 투자 성향에 따라 어떤 포인트를
                  더 중점적으로 볼지 해석할 수 있도록 구성했습니다.
                </p>
              </Box>

              <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                <CompareMultiLineCard
                  title="성장성 비교"
                  description="규모 차이가 큰 기업끼리 비교할 때는 절대 금액보다 매출 성장률 추이를 먼저 보는 것이 더 직관적입니다."
                  labels={chartYears}
                  series={growthSeries}
                  formatter={formatPercent}
                />

                <CompareMultiLineCard
                  title="수익성 비교"
                  description="매출이 커도 이익률이 낮으면 실제 수익성이 약할 수 있으므로, 영업이익률과 순이익률 추이를 함께 보는 것이 좋습니다."
                  labels={chartYears}
                  series={profitabilitySeries}
                  formatter={formatPercent}
                />

                <CompareBarCard
                  title="안정성 비교"
                  description="부채비율과 자본비율은 재무 구조를 해석하는 대표 지표입니다. 일반적으로 부채비율은 낮을수록, 자본비율은 높을수록 안정적으로 해석합니다."
                  data={stabilityBarData}
                  series={compareSeries}
                  formatter={formatPercent}
                />

                <CompareBarCard
                  title="규모 비교"
                  description="최근 연도 기준 매출, 자산, 현금 보유 수준을 함께 보면 대형 우량주 관점의 체급과 유동성 여력을 해석하는 데 도움이 됩니다."
                  data={sizeBarData}
                  series={compareSeries}
                  formatter={formatKoreanMoney}
                />
              </div>

              {isLoading && (
                <Box className="p-10 text-center">
                  <StatusState
                    variant="loading"
                    title="비교 데이터를 불러오는 중입니다"
                    description="선택한 기업의 최신 재무 데이터와 요약 정보를 요청하고 있습니다."
                    className="text-left"
                  />
                </Box>
              )}

              {loadError && (
                <Box className="p-6">
                  <StatusState
                    variant="error"
                    title={STATUS_MESSAGES.dataError}
                    description={loadError}
                  />
                </Box>
              )}

              {!!compareCompanies.length && (
                <Box className="p-5">
                  <SectionLabel>기업별 요약</SectionLabel>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {compareCompanies.map((company) => (
                      <div
                        key={company.displayName}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {company.displayName}
                        </div>
                        {company.error ? (
                          <p className="mt-3 text-sm leading-6 text-red-600">
                            {company.error}
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                            {(company.summaryLines.length > 0
                              ? company.summaryLines
                              : company.summaryText
                                  .split(/\n+/)
                                  .map((line) => line.trim())
                                  .filter(Boolean)
                                  .slice(0, 3)
                            )
                              .map((line, index) => (
                                <p key={`${company.displayName}-${index}`}>
                                  {renderFinancialStatusText(line)}
                                </p>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Box>
              )}
                </>
              )}
            </>
          )}
        </div>

      </div>
      <ScrollTopButton />
    </PageFrame>
  );
}


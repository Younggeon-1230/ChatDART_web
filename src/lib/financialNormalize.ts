import type {
  CompanySummaryApiResponse,
  IndustryType,
  SectorAverageApi,
  YearlyDataApi,
} from "@/types/api";

export type NumericInput = number | string | null | undefined;

export function resolveFinancialSector(
  metadata:
    | { is_financial_sector?: boolean | null }
    | null
    | undefined,
  sourceReport?: string | null
) {
  if (typeof metadata?.is_financial_sector === "boolean") {
    return metadata.is_financial_sector;
  }

  return sourceReport?.includes("[금융업") ?? false;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function pickRecord(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (isRecord(value)) return value;
  }

  return source;
}

export function pickString(
  source: Record<string, unknown>,
  keys: string[],
  fallback = ""
) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

export function toNumberOrNull(
  value: NumericInput | unknown,
  options: {
    allowNegative?: boolean;
    zeroIsMissing?: boolean;
  } = {}
): number | null {
  if (value === null || value === undefined) return null;

  const normalized =
    typeof value === "string"
      ? value.trim().replace(/,/g, "").replace(/[^\d.+\-eE]/g, "")
      : null;
  const parsed =
    typeof value === "string"
      ? normalized && normalized !== "-" && normalized !== "+"
        ? Number(normalized)
        : null
      : typeof value === "number"
        ? value
        : null;

  if (parsed === null || !Number.isFinite(parsed)) return null;
  if (options.zeroIsMissing && parsed === 0) return null;
  if (!options.allowNegative && parsed < 0) return null;

  return parsed;
}

export function isValidNumber(value: NumericInput): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function pickNumber(
  source: Record<string, unknown>,
  keys: string[],
  fallback = 0
) {
  for (const key of keys) {
    const parsed = toNumberOrNull(source[key], { allowNegative: true });
    if (parsed !== null) return parsed;
  }

  return fallback;
}

export function pickNullableNumber(
  source: Record<string, unknown>,
  keys: string[],
  options: { allowNegative?: boolean } = { allowNegative: true }
) {
  for (const key of keys) {
    if (source[key] === null) return null;
    const parsed = toNumberOrNull(source[key], options);
    if (parsed !== null) return parsed;
  }

  return null;
}

export function pickArray(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function toIndustryTypeOrNull(value: unknown): IndustryType | null {
  return value === "general" ||
    value === "bank" ||
    value === "insurance" ||
    value === "securities" ||
    value === "financial"
    ? value
    : null;
}

export function normalizeSummaryText(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .join("\n");
  }
  if (isRecord(value)) {
    const lines = pickArray(value, ["lines", "summaryLines", "summary_lines"]);
    if (lines.length > 0) return normalizeSummaryText(lines);
  }

  return "";
}

export function normalizePercentValue(value: NumericInput) {
  const safeValue = toNumberOrNull(value, { allowNegative: true });
  if (safeValue === null) return null;

  if (Math.abs(safeValue) > 0 && Math.abs(safeValue) <= 1) {
    return safeValue * 100;
  }

  return safeValue;
}

export function safeDivide(
  numerator: NumericInput,
  denominator: NumericInput,
  options: {
    allowNegativeNumerator?: boolean;
    allowNegativeDenominator?: boolean;
  } = {}
) {
  const safeNumerator = toNumberOrNull(numerator, {
    allowNegative: options.allowNegativeNumerator,
  });
  const safeDenominator = toNumberOrNull(denominator, {
    allowNegative: options.allowNegativeDenominator,
    zeroIsMissing: true,
  });

  if (safeNumerator === null || safeDenominator === null) return null;

  const result = safeNumerator / safeDenominator;
  return Number.isFinite(result) ? result : null;
}

export function calculateFinancialRatio(
  numerator: NumericInput,
  denominator: NumericInput,
  options: { allowNegativeNumerator?: boolean } = {}
) {
  const ratio = safeDivide(numerator, denominator, options);
  return ratio === null ? null : ratio * 100;
}

export function calculateFinancialGrowth(
  current: NumericInput,
  previous: NumericInput,
  options: { allowNegative?: boolean } = {}
) {
  const safeCurrent = toNumberOrNull(current, {
    allowNegative: options.allowNegative,
  });
  const safePrevious = toNumberOrNull(previous, {
    allowNegative: options.allowNegative,
    zeroIsMissing: true,
  });

  if (safeCurrent === null || safePrevious === null) return null;

  const result = ((safeCurrent - safePrevious) / Math.abs(safePrevious)) * 100;
  return Number.isFinite(result) ? result : null;
}

export function calculateProfitMargin(
  profit: NumericInput,
  revenue: NumericInput
) {
  return calculateFinancialRatio(profit, revenue, {
    allowNegativeNumerator: true,
  });
}

export function calculateDebtRatio(item: YearlyDataApi | null) {
  if (!item) return null;
  return calculateFinancialRatio(item.total_liabilities, item.equity);
}

export function calculateEquityRatio(item: YearlyDataApi | null) {
  if (!item) return null;
  return calculateFinancialRatio(item.equity, item.total_assets);
}

export function calculateROE(item: YearlyDataApi | null) {
  if (!item) return null;
  return calculateFinancialRatio(item.net_income, item.equity, {
    allowNegativeNumerator: true,
  });
}

export function calculateROA(item: YearlyDataApi | null) {
  if (!item) return null;
  return calculateFinancialRatio(item.net_income, item.total_assets, {
    allowNegativeNumerator: true,
  });
}

export function getFiscalYearNumber(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const matched = String(value ?? "").match(/\d{4}/);
  return matched ? Number(matched[0]) : 0;
}

export function sortFinancialHistory(history?: YearlyDataApi[]) {
  if (!history?.length) return [];

  return [...history].sort(
    (a, b) => getFiscalYearNumber(a.fiscal_year) - getFiscalYearNumber(b.fiscal_year)
  );
}

export function pickLatestFinancialYears(history: YearlyDataApi[], count = 3) {
  return sortFinancialHistory(history).slice(-count);
}

export function getFinancialValues(
  history: YearlyDataApi[],
  key: keyof YearlyDataApi
) {
  return history.map((item) => {
    const value = item[key];
    return isValidNumber(value) ? value : null;
  });
}

export function getFinancialMetricValue(
  history: YearlyDataApi[],
  key: "operating_margin" | "net_margin" | "revenue_growth_rate",
  fiscalYear: number
) {
  const index = history.findIndex((item) => item.fiscal_year === fiscalYear);
  const item = index >= 0 ? history[index] : undefined;

  if (!item) return null;

  const normalizedDirectValue =
    key === "revenue_growth_rate"
      ? toNumberOrNull(item[key], { allowNegative: true })
      : normalizePercentValue(item[key]);

  if (
    key === "revenue_growth_rate" &&
    normalizedDirectValue === 0 &&
    (index <= 0 || !toNumberOrNull(history[index - 1]?.revenue))
  ) {
    return null;
  }

  if (normalizedDirectValue !== null) return normalizedDirectValue;

  if (key === "operating_margin") {
    return calculateProfitMargin(item.operating_profit, item.revenue);
  }

  if (key === "net_margin") {
    return calculateProfitMargin(item.net_income, item.revenue);
  }

  const previous = index > 0 ? history[index - 1] : undefined;
  return calculateFinancialGrowth(item.revenue, previous?.revenue);
}

export function getFinancialMetricSeries(
  history: YearlyDataApi[],
  fullHistory: YearlyDataApi[],
  key: "operating_margin" | "net_margin" | "revenue_growth_rate"
) {
  return history.map((item) =>
    getFinancialMetricValue(fullHistory, key, item.fiscal_year)
  );
}

export function normalizeYearlyFinancialData(
  item: unknown
): YearlyDataApi | null {
  if (!isRecord(item)) return null;

  return {
    fiscal_year: pickNumber(item, ["fiscal_year", "fiscalYear", "year"]),
    revenue: pickNullableNumber(item, ["revenue", "sales", "매출액"]),
    cost_of_sales: pickNullableNumber(item, [
      "cost_of_sales",
      "costOfSales",
      "cost",
      "매출원가",
    ]),
    gross_profit: pickNullableNumber(item, [
      "gross_profit",
      "grossProfit",
      "매출총이익",
    ]),
    sga: pickNullableNumber(item, [
      "sga",
      "sellingGeneralAdministrative",
      "판매비와관리비",
    ]),
    operating_profit: pickNullableNumber(item, [
      "operating_profit",
      "operatingProfit",
      "operatingIncome",
      "영업이익",
    ]),
    other_income: pickNullableNumber(item, ["other_income", "otherIncome"]),
    other_expense: pickNullableNumber(item, [
      "other_expense",
      "otherExpense",
    ]),
    finance_income: pickNullableNumber(item, [
      "finance_income",
      "financeIncome",
    ]),
    finance_cost: pickNullableNumber(item, ["finance_cost", "financeCost"]),
    income_before_tax: pickNullableNumber(item, [
      "income_before_tax",
      "incomeBeforeTax",
    ]),
    income_tax_expense: pickNullableNumber(item, [
      "income_tax_expense",
      "incomeTaxExpense",
    ]),
    net_income: pickNullableNumber(item, ["net_income", "netIncome", "당기순이익"]),
    operating_cash_flow: pickNullableNumber(item, [
      "operating_cash_flow",
      "operatingCashFlow",
    ]),
    operating_margin: pickNullableNumber(item, [
      "operating_margin",
      "operatingMargin",
      "영업이익률",
    ]),
    net_margin: pickNullableNumber(item, ["net_margin", "netMargin", "순이익률"]),
    revenue_growth_rate: pickNullableNumber(item, [
      "revenue_growth_rate",
      "revenueGrowthRate",
      "매출성장률",
    ]),
    total_assets: pickNullableNumber(item, [
      "total_assets",
      "totalAssets",
      "자산총계",
    ]),
    total_liabilities: pickNullableNumber(item, [
      "total_liabilities",
      "totalLiabilities",
      "부채총계",
    ]),
    equity: pickNullableNumber(item, ["equity", "totalEquity", "자본총계"]),
    cash: pickNullableNumber(item, [
      "cash",
      "cashAndCashEquivalents",
      "현금및현금성자산",
    ]),
    source_report:
      pickString(item, ["source_report", "sourceReport", "reportName"]) ||
      null,
  };
}

function normalizeSectorAverage(value: unknown): SectorAverageApi | null {
  if (!isRecord(value)) return null;

  return {
    ...value,
    revenue_growth_rate: pickNullableNumber(value, [
      "revenue_growth_rate",
      "revenueGrowthRate",
    ]),
    operating_margin: pickNullableNumber(value, [
      "operating_margin",
      "operatingMargin",
    ]),
    net_margin: pickNullableNumber(value, ["net_margin", "netMargin"]),
    roe: pickNullableNumber(value, ["roe", "ROE"]),
    roa: pickNullableNumber(value, ["roa", "ROA"]),
    debt_ratio: pickNullableNumber(value, ["debt_ratio", "debtRatio"]),
    sample_size: pickNullableNumber(value, ["sample_size", "sampleSize"], {
      allowNegative: false,
    }),
  };
}

export function normalizeCompanySummaryResponse(
  raw: unknown,
  keyword: string
): CompanySummaryApiResponse {
  const root = isRecord(raw) ? raw : {};
  const data = pickRecord(root, ["data", "result", "summary", "payload"]);
  const nestedSummary = isRecord(data.summary) ? data.summary : {};
  const aiSummary = isRecord(data.aiSummary) ? data.aiSummary : {};
  const directSummaryLines = pickArray(data, [
    "summaryLines",
    "summary_lines",
    "threeLineSummary",
    "three_line_summary",
  ]);
  const nestedSummaryLines = pickArray(nestedSummary, ["lines"]);
  const aiSummaryLines = pickArray(aiSummary, ["lines"]);
  const rawSummaryLines =
    directSummaryLines.length > 0
      ? directSummaryLines
      : nestedSummaryLines.length > 0
        ? nestedSummaryLines
        : aiSummaryLines;
  const summaryText =
    normalizeSummaryText(rawSummaryLines.length > 0 ? rawSummaryLines : null) ||
    normalizeSummaryText(
      data.summary_text ??
        data.summaryText ??
        data.aiSummaryText ??
        data.aiSummary ??
        data.summary
    );
  const history = sortFinancialHistory(
    pickArray(data, [
      "history",
      "financials",
      "yearlyData",
      "yearly_data",
      "statements",
    ])
      .map(normalizeYearlyFinancialData)
      .filter((item): item is YearlyDataApi => item !== null)
  );
  const fiscalYear =
    pickNumber(data, ["fiscal_year", "fiscalYear", "year"]) ||
    history.at(-1)?.fiscal_year ||
    new Date().getFullYear();

  return {
    company_name: pickString(
      data,
      ["company_name", "companyName", "corpName", "name", "keyword"],
      keyword
    ),
    stock_code: pickString(data, ["stock_code", "stockCode", "code"], ""),
    fiscal_year: fiscalYear,
    sector:
      pickString(data, [
        "sector",
        "industry",
        "industryName",
        "industry_name",
      ]) || null,
    is_financial_sector:
      typeof data.is_financial_sector === "boolean"
        ? data.is_financial_sector
        : typeof data.isFinancialSector === "boolean"
          ? data.isFinancialSector
          : undefined,
    industry_type: toIndustryTypeOrNull(
      data.industry_type ?? data.industryType
    ),
    revenue_label:
      pickString(data, ["revenue_label", "revenueLabel"]) || null,
    operating_profit_label:
      pickString(data, [
        "operating_profit_label",
        "operatingProfitLabel",
      ]) || null,
    business:
      pickString(data, [
        "business",
        "mainBusiness",
        "main_business",
        "businessSummary",
        "business_summary",
        "description",
      ]) || null,
    mainBusiness:
      pickString(data, ["mainBusiness", "main_business"]) || null,
    businessSummary:
      pickString(data, ["businessSummary", "business_summary"]) || null,
    summary_text: summaryText,
    growth_status:
      pickString(data, ["growth_status", "growthStatus"], "정보 없음") ||
      "정보 없음",
    stability_status:
      pickString(data, ["stability_status", "stabilityStatus"], "정보 없음") ||
      "정보 없음",
    profitability_status:
      pickString(
        data,
        ["profitability_status", "profitabilityStatus"],
        "정보 없음"
      ) || "정보 없음",
    metrics: isRecord(data.metrics) ? data.metrics : null,
    warning_flags: pickArray(data, ["warning_flags", "warningFlags"]),
    sector_avg: normalizeSectorAverage(data.sector_avg ?? data.sectorAvg),
    sector_rank: data.sector_rank ?? data.sectorRank,
    history,
  };
}

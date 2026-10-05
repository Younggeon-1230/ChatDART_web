import type { YearlyDataApi } from "@/types/api";
import {
  calculateFinancialGrowth,
  calculateProfitMargin,
  getFiscalYearNumber,
  resolveFinancialSector,
  toNumberOrNull,
} from "@/lib/financialNormalize";

export const OPERATING_MARGIN_SHARP_DECLINE_THRESHOLD_PERCENT_POINT = 3;
export const OPERATING_MARGIN_IMPROVED_THRESHOLD_PERCENT_POINT = 1;
export const NET_INCOME_TO_OPERATING_PROFIT_WARNING_MULTIPLE = 1.5;
export const OCF_RATIO_MIN_NET_INCOME = 10_000_000_000;
export const OCF_TO_NET_INCOME_CAUTION_THRESHOLD = 0.4;
export const EXPERIMENTAL_CASH_FLOW_MIN_NET_INCOME =
  OCF_RATIO_MIN_NET_INCOME;
export const EXPERIMENTAL_CASH_FLOW_TO_NET_INCOME_RATIO_THRESHOLD =
  OCF_TO_NET_INCOME_CAUTION_THRESHOLD;

export type FinancialInsightType = "warning" | "positive";

export type FinancialInsightEvidence = {
  label: string;
  currentValue: number | null;
  previousValue?: number | null;
  changeRate?: number | null;
  unit?: "currency" | "percent" | "ratio";
  displayFractionDigits?: number;
};

export type FinancialInsight = {
  id: string;
  type: FinancialInsightType;
  title: string;
  description: string;
  year: string | number;
  evidence: FinancialInsightEvidence[];
};

export const PROFIT_QUALITY_INSIGHT_IDS = [
  "operating-loss-net-profit",
  "net-income-much-higher-than-operating-profit",
] as const;

export type ProfitQualityInsightId =
  (typeof PROFIT_QUALITY_INSIGHT_IDS)[number];

export function isProfitQualityInsight(insight: FinancialInsight) {
  return PROFIT_QUALITY_INSIGHT_IDS.includes(
    insight.id as ProfitQualityInsightId
  );
}

export type FinancialInsightInput = Partial<
  Omit<
    YearlyDataApi,
    | "fiscal_year"
    | "revenue"
    | "operating_profit"
    | "net_income"
    | "operating_cash_flow"
    | "operating_margin"
    | "net_margin"
    | "revenue_growth_rate"
    | "total_assets"
    | "total_liabilities"
    | "equity"
    | "cash"
  >
> & {
  fiscal_year?: string | number | null;
  revenue?: string | number | null;
  operating_profit?: string | number | null;
  net_income?: string | number | null;
  operating_cash_flow?: string | number | null;
  is_financial_sector?: boolean;
  stock_code?: string | number | null;
  company_name?: string | null;
  operating_margin?: string | number | null;
  net_margin?: string | number | null;
  revenue_growth_rate?: string | number | null;
  total_assets?: string | number | null;
  total_liabilities?: string | number | null;
  equity?: string | number | null;
  cash?: string | number | null;
};

type NormalizedFinancialRow = {
  year: string | number;
  yearNumber: number;
  revenue: number | null;
  operatingProfit: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  operatingMargin: number | null;
  isFinancialSector: boolean;
  stockCode: string | number | null;
  companyName: string | null;
};

export type ExperimentalCashFlowInsightResult = {
  stockCode: string | number | null;
  companyName: string | null;
  year: string | number;
  netIncome: number | null;
  operatingCashFlow: number | null;
  cashFlowToNetIncomeRatio: number | null;
  observation: "zero-operating-cash-flow" | null;
  matched: boolean;
};

export type FinancialInsightAnalysisOptions = {
  isFinancialSector?: boolean;
};

type InsightRuleContext = {
  current: NormalizedFinancialRow;
  previous: NormalizedFinancialRow | null;
};

const INSIGHT_TYPE_ORDER: Record<FinancialInsightType, number> = {
  warning: 0,
  positive: 1,
};

function normalizeFinancialRow(
  item: FinancialInsightInput,
  options?: FinancialInsightAnalysisOptions
): NormalizedFinancialRow | null {
  const yearNumber = getFiscalYearNumber(item.fiscal_year);

  if (!yearNumber) return null;

  const revenue = toNumberOrNull(item.revenue, { allowNegative: true });
  const operatingProfit = toNumberOrNull(item.operating_profit, {
    allowNegative: true,
  });
  const netIncome = toNumberOrNull(item.net_income, { allowNegative: true });
  const operatingCashFlow = toNumberOrNull(item.operating_cash_flow, {
    allowNegative: true,
  });
  const operatingMargin =
    revenue !== null && operatingProfit !== null && revenue > 0
      ? calculateProfitMargin(operatingProfit, revenue)
      : null;

  return {
    year: item.fiscal_year ?? yearNumber,
    yearNumber,
    revenue,
    operatingProfit,
    netIncome,
    operatingCashFlow,
    operatingMargin,
    isFinancialSector:
      options?.isFinancialSector ??
      resolveFinancialSector(item, item.source_report),
    stockCode: item.stock_code ?? null,
    companyName: item.company_name ?? null,
  };
}

function normalizeFinancialRows(
  financials: readonly FinancialInsightInput[],
  options?: FinancialInsightAnalysisOptions
): NormalizedFinancialRow[] {
  return financials
    .map((item) => normalizeFinancialRow(item, options))
    .filter((item): item is NormalizedFinancialRow => item !== null)
    .sort((a, b) => a.yearNumber - b.yearNumber);
}

function hasNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function calculateChangeRate(
  current: number | null,
  previous: number | null
) {
  if (!hasNumber(current) || !hasNumber(previous)) return null;
  return calculateFinancialGrowth(current, previous, { allowNegative: true });
}

function marginChange(
  current: NormalizedFinancialRow,
  previous: NormalizedFinancialRow | null
) {
  if (!previous) return null;
  if (!hasNumber(current.operatingMargin) || !hasNumber(previous.operatingMargin)) {
    return null;
  }

  return current.operatingMargin - previous.operatingMargin;
}

function makeInsight(
  id: string,
  type: FinancialInsightType,
  title: string,
  description: string,
  year: string | number,
  evidence: FinancialInsightEvidence[]
): FinancialInsight {
  return {
    id,
    type,
    title,
    description,
    year,
    evidence,
  };
}

function detectOperatingLossNetProfit({
  current,
}: InsightRuleContext): FinancialInsight | null {
  if (
    !hasNumber(current.operatingProfit) ||
    !hasNumber(current.netIncome) ||
    current.operatingProfit >= 0 ||
    current.netIncome <= 0
  ) {
    return null;
  }

  return makeInsight(
    "operating-loss-net-profit",
    "warning",
    "영업손실이 발생했지만 당기순이익은 흑자입니다.",
    "본업 외 손익이나 일회성 요인의 영향을 확인할 필요가 있습니다.",
    current.year,
    [
      {
        label: "영업이익",
        currentValue: current.operatingProfit,
        unit: "currency",
      },
      {
        label: "당기순이익",
        currentValue: current.netIncome,
        unit: "currency",
      },
    ]
  );
}

function detectRevenueUpOperatingProfitDown({
  current,
  previous,
}: InsightRuleContext): FinancialInsight | null {
  if (
    current.isFinancialSector ||
    !previous ||
    !hasNumber(current.revenue) ||
    !hasNumber(previous.revenue) ||
    !hasNumber(current.operatingProfit) ||
    !hasNumber(previous.operatingProfit) ||
    current.revenue <= previous.revenue ||
    current.operatingProfit >= previous.operatingProfit
  ) {
    return null;
  }

  return makeInsight(
    "revenue-up-operating-profit-down",
    "warning",
    "매출은 증가했지만 영업이익은 감소했습니다.",
    "매출 성장에 비해 비용 부담이 커졌는지 확인할 필요가 있습니다.",
    current.year,
    [
      {
        label: "매출액",
        currentValue: current.revenue,
        previousValue: previous.revenue,
        changeRate: calculateChangeRate(current.revenue, previous.revenue),
        unit: "currency",
      },
      {
        label: "영업이익",
        currentValue: current.operatingProfit,
        previousValue: previous.operatingProfit,
        changeRate: calculateChangeRate(
          current.operatingProfit,
          previous.operatingProfit
        ),
        unit: "currency",
      },
    ]
  );
}

function detectOperatingMarginSharpDecline({
  current,
  previous,
}: InsightRuleContext): FinancialInsight | null {
  const change = marginChange(current, previous);

  if (
    current.isFinancialSector ||
    !previous ||
    change === null ||
    change > -OPERATING_MARGIN_SHARP_DECLINE_THRESHOLD_PERCENT_POINT
  ) {
    return null;
  }

  return makeInsight(
    "operating-margin-sharp-decline",
    "warning",
    "영업이익률이 전년 대비 크게 하락했습니다.",
    "매출 대비 영업이익이 줄어 비용 구조나 수익성 변화를 확인할 필요가 있습니다.",
    current.year,
    [
      {
        label: "영업이익률",
        currentValue: current.operatingMargin,
        previousValue: previous.operatingMargin,
        changeRate: change,
        unit: "percent",
      },
    ]
  );
}

function detectNetIncomeMuchHigherThanOperatingProfit({
  current,
}: InsightRuleContext): FinancialInsight | null {
  if (
    !hasNumber(current.operatingProfit) ||
    !hasNumber(current.netIncome) ||
    current.operatingProfit <= 0 ||
    current.netIncome <
      current.operatingProfit * NET_INCOME_TO_OPERATING_PROFIT_WARNING_MULTIPLE
  ) {
    return null;
  }

  return makeInsight(
    "net-income-much-higher-than-operating-profit",
    "warning",
    "당기순이익이 영업이익보다 과도하게 큽니다.",
    "본업 외 손익이나 일회성 이익이 순이익에 크게 반영되었는지 확인할 필요가 있습니다.",
    current.year,
    [
      {
        label: "영업이익",
        currentValue: current.operatingProfit,
        unit: "currency",
      },
      {
        label: "당기순이익",
        currentValue: current.netIncome,
        unit: "currency",
      },
      {
        label: "당기순이익/영업이익",
        currentValue: current.netIncome / current.operatingProfit,
        unit: "ratio",
      },
    ]
  );
}

function detectNetIncomePositiveOperatingCashFlowNegative({
  current,
}: InsightRuleContext): FinancialInsight | null {
  if (
    current.isFinancialSector ||
    !hasNumber(current.netIncome) ||
    !hasNumber(current.operatingCashFlow) ||
    current.netIncome <= 0 ||
    current.operatingCashFlow >= 0
  ) {
    return null;
  }

  return makeInsight(
    "net-income-positive-operating-cash-flow-negative",
    "warning",
    "당기순이익은 흑자이지만 영업활동현금흐름은 음수입니다.",
    "회계상 이익이 실제 영업현금 유입으로 이어졌는지 추가 확인이 필요합니다.",
    current.year,
    [
      {
        label: "당기순이익",
        currentValue: current.netIncome,
        unit: "currency",
      },
      {
        label: "영업활동현금흐름",
        currentValue: current.operatingCashFlow,
        unit: "currency",
      },
    ]
  );
}

function detectOperatingCashFlowMuchLowerThanNetIncome({
  current,
}: InsightRuleContext): FinancialInsight | null {
  if (
    current.isFinancialSector ||
    !hasNumber(current.netIncome) ||
    !hasNumber(current.operatingCashFlow) ||
    current.netIncome < OCF_RATIO_MIN_NET_INCOME ||
    current.operatingCashFlow <= 0
  ) {
    return null;
  }

  const ratio = current.operatingCashFlow / current.netIncome;

  if (
    !Number.isFinite(ratio) ||
    ratio >= OCF_TO_NET_INCOME_CAUTION_THRESHOLD
  ) {
    return null;
  }

  const evidencePercentage = Math.floor(ratio * 10000) / 100;

  return makeInsight(
    "operating-cash-flow-much-lower-than-net-income",
    "warning",
    "순이익 대비 영업활동현금흐름이 낮음",
    "해당 연도의 영업활동현금흐름이 당기순이익의 40% 미만으로 나타났습니다. 단년도 현상인지 다음 기간의 흐름과 현금흐름표 세부 항목을 함께 확인할 필요가 있습니다.",
    current.year,
    [
      {
        label: "당기순이익",
        previousValue: null,
        currentValue: current.netIncome,
        changeRate: null,
        unit: "currency",
      },
      {
        label: "영업활동현금흐름",
        previousValue: null,
        currentValue: current.operatingCashFlow,
        changeRate: null,
        unit: "currency",
      },
      {
        label: "영업활동현금흐름/순이익 비율",
        previousValue: null,
        currentValue: evidencePercentage,
        changeRate: null,
        unit: "percent",
        displayFractionDigits: 2,
      },
    ]
  );
}

function detectRevenueAndOperatingProfitUp({
  current,
  previous,
}: InsightRuleContext): FinancialInsight | null {
  if (
    current.isFinancialSector ||
    !previous ||
    !hasNumber(current.revenue) ||
    !hasNumber(previous.revenue) ||
    !hasNumber(current.operatingProfit) ||
    !hasNumber(previous.operatingProfit) ||
    current.revenue <= previous.revenue ||
    current.operatingProfit <= previous.operatingProfit
  ) {
    return null;
  }

  return makeInsight(
    "revenue-and-operating-profit-up",
    "positive",
    "매출과 영업이익이 함께 증가했습니다.",
    "외형 성장과 수익성 개선이 동시에 나타났습니다.",
    current.year,
    [
      {
        label: "매출액",
        currentValue: current.revenue,
        previousValue: previous.revenue,
        changeRate: calculateChangeRate(current.revenue, previous.revenue),
        unit: "currency",
      },
      {
        label: "영업이익",
        currentValue: current.operatingProfit,
        previousValue: previous.operatingProfit,
        changeRate: calculateChangeRate(
          current.operatingProfit,
          previous.operatingProfit
        ),
        unit: "currency",
      },
    ]
  );
}

function detectOperatingMarginImproved({
  current,
  previous,
}: InsightRuleContext): FinancialInsight | null {
  const change = marginChange(current, previous);

  if (
    current.isFinancialSector ||
    !previous ||
    change === null ||
    change < OPERATING_MARGIN_IMPROVED_THRESHOLD_PERCENT_POINT
  ) {
    return null;
  }

  return makeInsight(
    "operating-margin-improved",
    "positive",
    "영업이익률이 전년 대비 개선되었습니다.",
    "매출 대비 영업이익 비중이 높아졌습니다.",
    current.year,
    [
      {
        label: "영업이익률",
        currentValue: current.operatingMargin,
        previousValue: previous.operatingMargin,
        changeRate: change,
        unit: "percent",
      },
    ]
  );
}

function detectOperatingProfitTurnaround({
  current,
  previous,
}: InsightRuleContext): FinancialInsight | null {
  if (
    !previous ||
    !hasNumber(current.operatingProfit) ||
    !hasNumber(previous.operatingProfit) ||
    previous.operatingProfit > 0 ||
    current.operatingProfit <= 0
  ) {
    return null;
  }

  return makeInsight(
    "operating-profit-turnaround",
    "positive",
    "영업손실에서 흑자로 전환했습니다.",
    "본업 수익성이 전년 대비 개선되었습니다.",
    current.year,
    [
      {
        label: "영업이익",
        currentValue: current.operatingProfit,
        previousValue: previous.operatingProfit,
        changeRate: calculateChangeRate(
          current.operatingProfit,
          previous.operatingProfit
        ),
        unit: "currency",
      },
    ]
  );
}

function detectOperatingProfitAndNetIncomeUp({
  current,
  previous,
}: InsightRuleContext): FinancialInsight | null {
  if (
    !previous ||
    !hasNumber(current.operatingProfit) ||
    !hasNumber(previous.operatingProfit) ||
    !hasNumber(current.netIncome) ||
    !hasNumber(previous.netIncome) ||
    current.operatingProfit <= previous.operatingProfit ||
    current.netIncome <= previous.netIncome
  ) {
    return null;
  }

  return makeInsight(
    "operating-profit-and-net-income-up",
    "positive",
    "영업이익과 당기순이익이 함께 증가했습니다.",
    "본업 이익과 최종 이익이 모두 전년 대비 개선되었습니다.",
    current.year,
    [
      {
        label: "영업이익",
        currentValue: current.operatingProfit,
        previousValue: previous.operatingProfit,
        changeRate: calculateChangeRate(
          current.operatingProfit,
          previous.operatingProfit
        ),
        unit: "currency",
      },
      {
        label: "당기순이익",
        currentValue: current.netIncome,
        previousValue: previous.netIncome,
        changeRate: calculateChangeRate(current.netIncome, previous.netIncome),
        unit: "currency",
      },
    ]
  );
}

function detectOperatingCashFlowTurnaround({
  current,
  previous,
}: InsightRuleContext): FinancialInsight | null {
  if (
    !previous ||
    current.isFinancialSector ||
    previous.isFinancialSector ||
    !hasNumber(current.operatingCashFlow) ||
    !hasNumber(previous.operatingCashFlow) ||
    previous.operatingCashFlow > 0 ||
    current.operatingCashFlow <= 0
  ) {
    return null;
  }

  return makeInsight(
    "operating-cash-flow-turnaround",
    "positive",
    "영업활동현금흐름이 흑자로 전환했습니다.",
    "영업활동현금흐름이 전년 음수 또는 0에서 당해 양수로 전환했습니다. 다음 기간에도 흐름이 이어지는지 확인할 필요가 있습니다.",
    current.year,
    [
      {
        label: "영업활동현금흐름",
        currentValue: current.operatingCashFlow,
        previousValue: previous.operatingCashFlow,
        unit: "currency",
      },
    ]
  );
}

const WARNING_RULES = [
  detectOperatingLossNetProfit,
  detectRevenueUpOperatingProfitDown,
  detectOperatingMarginSharpDecline,
  detectNetIncomeMuchHigherThanOperatingProfit,
  detectNetIncomePositiveOperatingCashFlowNegative,
  detectOperatingCashFlowMuchLowerThanNetIncome,
];

const POSITIVE_RULES = [
  detectRevenueAndOperatingProfitUp,
  detectOperatingMarginImproved,
  detectOperatingProfitTurnaround,
  detectOperatingProfitAndNetIncomeUp,
  detectOperatingCashFlowTurnaround,
];

// Production financial-sector rows provide revenue, operating profit, and
// operating cash flow as null. Every formal rule above needs at least one of
// those inputs, so net income alone produces no warning or positive insight.

function dedupeInsights(insights: FinancialInsight[]) {
  const seen = new Set<string>();

  return insights.filter((insight) => {
    const key = `${insight.type}:${insight.id}:${insight.year}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function detectWarningInsights(
  financials: readonly FinancialInsightInput[],
  options?: FinancialInsightAnalysisOptions
): FinancialInsight[] {
  const rows = normalizeFinancialRows(financials, options);

  return dedupeInsights(
    rows.flatMap((current, index) => {
      const context: InsightRuleContext = {
        current,
        previous: index > 0 ? rows[index - 1] : null,
      };

      return WARNING_RULES.map((rule) => rule(context)).filter(
        (insight): insight is FinancialInsight => insight !== null
      );
    })
  );
}

export function detectPositiveInsights(
  financials: readonly FinancialInsightInput[],
  options?: FinancialInsightAnalysisOptions
): FinancialInsight[] {
  const rows = normalizeFinancialRows(financials, options);

  return dedupeInsights(
    rows.flatMap((current, index) => {
      const context: InsightRuleContext = {
        current,
        previous: index > 0 ? rows[index - 1] : null,
      };

      return POSITIVE_RULES.map((rule) => rule(context)).filter(
        (insight): insight is FinancialInsight => insight !== null
      );
    })
  );
}

export function analyzeFinancialInsights(
  financials: readonly FinancialInsightInput[] | null | undefined,
  options?: FinancialInsightAnalysisOptions
): FinancialInsight[] {
  if (!financials?.length) return [];

  return dedupeInsights([
    ...detectWarningInsights(financials, options),
    ...detectPositiveInsights(financials, options),
  ]).sort((a, b) => {
    const typeDiff = INSIGHT_TYPE_ORDER[a.type] - INSIGHT_TYPE_ORDER[b.type];
    if (typeDiff !== 0) return typeDiff;
    return getFiscalYearNumber(b.year) - getFiscalYearNumber(a.year);
  });
}

export function analyzeExperimentalCashFlowInsight(
  financials: readonly FinancialInsightInput[] | null | undefined,
  options?: FinancialInsightAnalysisOptions
): ExperimentalCashFlowInsightResult[] {
  if (!financials?.length) return [];

  return normalizeFinancialRows(financials, options)
    .map((row) => {
      const cashFlowToNetIncomeRatio =
        hasNumber(row.netIncome) &&
        hasNumber(row.operatingCashFlow) &&
        row.netIncome !== 0 &&
        row.operatingCashFlow > 0
          ? row.operatingCashFlow / row.netIncome
          : null;
      const observation: ExperimentalCashFlowInsightResult["observation"] =
        row.operatingCashFlow === 0 ? "zero-operating-cash-flow" : null;
      const matched =
        !row.isFinancialSector &&
        hasNumber(row.netIncome) &&
        row.netIncome >= EXPERIMENTAL_CASH_FLOW_MIN_NET_INCOME &&
        hasNumber(row.operatingCashFlow) &&
        row.operatingCashFlow > 0 &&
        cashFlowToNetIncomeRatio !== null &&
        Number.isFinite(cashFlowToNetIncomeRatio) &&
        cashFlowToNetIncomeRatio <
          EXPERIMENTAL_CASH_FLOW_TO_NET_INCOME_RATIO_THRESHOLD;

      return {
        stockCode: row.stockCode,
        companyName: row.companyName,
        year: row.year,
        netIncome: row.netIncome,
        operatingCashFlow: row.operatingCashFlow,
        cashFlowToNetIncomeRatio,
        observation,
        matched,
      };
    })
    .reverse();
}

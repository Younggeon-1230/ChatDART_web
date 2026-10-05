import type { YearlyDataApi } from "@/types/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import {
  calculateDebtRatio,
  calculateEquityRatio,
  calculateFinancialGrowth as calculateNormalizedGrowth,
  calculateFinancialRatio as calculateNormalizedRatio,
  calculateROE,
  sortFinancialHistory,
  toNumberOrNull,
} from "@/lib/financialNormalize";

export type FinancialDirection = "increase" | "decrease" | "stable" | "missing";

export type SummaryTextCard = {
  title: string;
  content: string;
};

export type PerspectiveCard = {
  title: string;
  content: string;
};

type NumericInput = number | string | null | undefined;

type NarrativeMetric = {
  label: string;
  current?: NumericInput;
  previous?: NumericInput;
  unit: "amount" | "percent" | "won" | "multiple";
  allowNegative?: boolean;
  zeroIsMissing?: boolean;
  lowerIsBetter?: boolean;
};

type StatusTexts = {
  growth?: string;
  stability?: string;
  profitability?: string;
};

const MISSING_DATA_TEXT =
  "확인 가능한 데이터가 부족해 단정적인 해석은 어렵습니다. 추가 공시나 최근 실적 자료를 함께 확인할 필요가 있습니다.";

export function toFinancialNumber(
  value: NumericInput,
  options: {
    allowNegative?: boolean;
    zeroIsMissing?: boolean;
  } = {}
): number | null {
  return toNumberOrNull(value, options);
}

export function calculateFinancialRatio(
  numerator: NumericInput,
  denominator: NumericInput,
  options: { allowNegativeNumerator?: boolean } = {}
): number | null {
  return calculateNormalizedRatio(numerator, denominator, options);
}

export function calculateFinancialGrowth(
  current: NumericInput,
  previous: NumericInput,
  options: { allowNegative?: boolean } = {}
): number | null {
  return calculateNormalizedGrowth(current, previous, options);
}

export function getFinancialDirection(value: NumericInput): FinancialDirection {
  const safeValue = toFinancialNumber(value, { allowNegative: true });

  if (safeValue === null) return "missing";
  if (safeValue > 1) return "increase";
  if (safeValue < -1) return "decrease";
  return "stable";
}

export function formatFinancialAmount(value: NumericInput): string {
  const safeValue = toFinancialNumber(value, { allowNegative: true });
  if (safeValue === null) return "-";

  const sign = safeValue < 0 ? "-" : "";
  const abs = Math.abs(safeValue);
  const eok = abs >= 100_000_000 ? abs / 100_000_000 : abs;

  if (eok >= 10000) {
    const jo = Math.floor(eok / 10000);
    const remainEok = Math.round(eok % 10000);
    return remainEok > 0
      ? `${sign}${formatNumber(jo)}조 ${formatCurrency(remainEok, "억")}`
      : `${sign}${formatNumber(jo)}조`;
  }

  if (abs >= 100_000_000) {
    return `${sign}${formatCurrency(Math.round(eok), "억")}`;
  }

  return `${sign}${formatCurrency(Math.round(abs), "원")}`;
}

export function formatFinancialPercent(value: NumericInput): string {
  const safeValue = toFinancialNumber(value, { allowNegative: true });
  return safeValue === null ? "-" : formatPercent(safeValue, 1);
}

export function formatPerShareWon(value: NumericInput): string {
  const safeValue = toFinancialNumber(value, { allowNegative: true });
  return safeValue === null ? "-" : `${formatNumber(Math.round(safeValue))}원`;
}

export function formatMultiple(value: NumericInput): string {
  const safeValue = toFinancialNumber(value, { allowNegative: true });
  return safeValue === null ? "-" : `${safeValue.toFixed(1)}배`;
}

function sortHistory(history: YearlyDataApi[]) {
  return sortFinancialHistory(history);
}

function pickVariant(seed: string, templates: string[]) {
  const code = seed
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return templates[code % templates.length];
}

function hasData(...values: NumericInput[]) {
  return values.some(
    (value) => toFinancialNumber(value, { allowNegative: true }) !== null
  );
}

function formatOptionalAmount(
  value: NumericInput,
  fallback = "정보를 확인할 수 없습니다"
) {
  return toFinancialNumber(value, { allowNegative: true }) === null
    ? fallback
    : formatFinancialAmount(value);
}

function formatOptionalPercent(
  value: NumericInput,
  fallback = "정보를 확인할 수 없습니다"
) {
  return toFinancialNumber(value, { allowNegative: true }) === null
    ? fallback
    : formatFinancialPercent(value);
}

function describeMetricChange(metric: NarrativeMetric): string {
  const current = toFinancialNumber(metric.current, {
    allowNegative: metric.allowNegative,
    zeroIsMissing: metric.zeroIsMissing,
  });

  if (current === null) {
    return `${metric.label}은 확인 가능한 데이터가 부족합니다.`;
  }

  const growth = calculateFinancialGrowth(metric.current, metric.previous, {
    allowNegative: metric.allowNegative,
  });
  const formatted =
    metric.unit === "amount"
      ? formatFinancialAmount(current)
      : metric.unit === "percent"
        ? formatFinancialPercent(current)
        : metric.unit === "multiple"
          ? formatMultiple(current)
          : formatPerShareWon(current);

  if (growth === null) {
    return `${metric.label}은 ${formatted} 수준으로 확인되며, 비교 가능한 전년 데이터는 제한적입니다.`;
  }

  const direction = getFinancialDirection(growth);
  const growthText = formatFinancialPercent(growth);

  if (direction === "increase") {
    return metric.lowerIsBetter
      ? `${metric.label}은 ${formatted}으로 전년 대비 ${growthText} 높아져 부담 요인으로 이어지는지 점검이 필요합니다.`
      : `${metric.label}은 ${formatted}으로 전년 대비 ${growthText} 증가해 개선세를 참고할 수 있습니다.`;
  }

  if (direction === "decrease") {
    return metric.lowerIsBetter
      ? `${metric.label}은 ${formatted}으로 전년 대비 ${growthText} 낮아져 안정성 측면에서 참고할 수 있습니다.`
      : `${metric.label}은 ${formatted}으로 전년 대비 ${growthText} 감소해 일시적 요인인지 확인할 필요가 있습니다.`;
  }

  return `${metric.label}은 ${formatted}으로 전년과 큰 차이 없이 유지되는 흐름입니다.`;
}

function getLatestMargin(item: YearlyDataApi | null, key: "operating_margin" | "net_margin") {
  if (!item) return null;

  const directValue = toFinancialNumber(item[key], { allowNegative: true });
  if (directValue !== null) {
    return Math.abs(directValue) > 0 && Math.abs(directValue) <= 1
      ? directValue * 100
      : directValue;
  }

  return calculateFinancialRatio(
    key === "operating_margin" ? item.operating_profit : item.net_income,
    item.revenue,
    { allowNegativeNumerator: true }
  );
}

export function getDebtRatio(item: YearlyDataApi | null) {
  return calculateDebtRatio(item);
}

export function getEquityRatio(item: YearlyDataApi | null) {
  return calculateEquityRatio(item);
}

export function getRoe(item: YearlyDataApi | null) {
  return calculateROE(item);
}

export function buildThreeLineFinancialSummary(
  companyName: string,
  history: YearlyDataApi[],
  statusTexts: StatusTexts = {}
): string[] {
  const sorted = sortHistory(history);
  const latest = sorted.at(-1) ?? null;
  const previous = sorted.at(-2) ?? null;

  if (!latest) {
    return [
      `${companyName}은 현재 확인 가능한 최근 재무 데이터가 부족합니다.`,
      MISSING_DATA_TEXT,
      "투자 판단에는 최신 공시, 업종 상황, 주가 지표를 함께 확인하는 것이 좋습니다.",
    ];
  }

  const revenueGrowth = calculateFinancialGrowth(
    latest.revenue,
    previous?.revenue
  );
  const operatingMargin = getLatestMargin(latest, "operating_margin");
  const netMargin = getLatestMargin(latest, "net_margin");
  const debtRatio = getDebtRatio(latest);
  const roe = getRoe(latest);
  const revenueText = formatOptionalAmount(latest.revenue);
  const operatingProfitText = formatOptionalAmount(
    latest.operating_profit,
    "정보를 확인할 수 없습니다"
  );

  const hasRevenue = toFinancialNumber(latest.revenue) !== null;
  const hasOperatingProfit =
    toFinancialNumber(latest.operating_profit, { allowNegative: true }) !==
    null;

  const first =
    hasRevenue && hasOperatingProfit
      ? pickVariant(String(latest.fiscal_year), [
        `${companyName}의 최근 매출은 ${revenueText}이며, ${describeMetricChange({
          label: "영업이익",
          current: latest.operating_profit,
          previous: previous?.operating_profit,
          unit: "amount",
          allowNegative: true,
        })}`,
        `${companyName}은 최근 기준 매출 ${revenueText}, 영업이익 ${operatingProfitText} 수준으로 확인됩니다.`,
        `${companyName}의 외형 흐름은 ${describeMetricChange({
          label: "매출",
          current: latest.revenue,
          previous: previous?.revenue,
          unit: "amount",
        })}`,
        ])
      : hasRevenue
        ? `${companyName}의 ${describeMetricChange({
            label: "매출",
            current: latest.revenue,
            previous: previous?.revenue,
            unit: "amount",
          })} 영업이익 데이터는 확인 가능한 범위가 제한적입니다.`
        : hasOperatingProfit
          ? `${companyName}의 매출 데이터는 제한적이며, ${describeMetricChange({
              label: "영업이익",
              current: latest.operating_profit,
              previous: previous?.operating_profit,
              unit: "amount",
              allowNegative: true,
            })}`
          : `${companyName}의 매출과 영업이익 데이터는 일부만 확인되어 외형 흐름 해석에 주의가 필요합니다.`;

  const second = hasData(revenueGrowth, operatingMargin, netMargin, roe)
    ? pickVariant(`${companyName}-${latest.fiscal_year}`, [
        `수익성은 영업이익률 ${formatFinancialPercent(
          operatingMargin
        )}, 순이익률 ${formatFinancialPercent(
          netMargin
        )}을 함께 보며 개선 여부를 확인할 수 있습니다.`,
        `매출 성장률은 ${formatOptionalPercent(
          revenueGrowth
        )}, ROE는 ${formatOptionalPercent(
          roe
        )} 수준으로 수익 창출 효율을 참고할 수 있습니다.`,
        `성장성은 ${
          revenueGrowth === null
            ? statusTexts.growth ?? "정보를 확인할 수 없습니다"
            : formatFinancialPercent(revenueGrowth)
        } 흐름이며, 이익률이 함께 유지되는지 점검할 필요가 있습니다.`,
      ])
    : "성장성과 수익성 판단에 필요한 비교 데이터가 부족해 이익률과 전년 대비 흐름을 추가로 확인할 필요가 있습니다.";

  const third = hasData(debtRatio, latest.cash, latest.equity)
    ? pickVariant(`${latest.fiscal_year}-${companyName}`, [
        `부채비율은 ${formatOptionalPercent(
          debtRatio
        )}, 현금은 ${formatOptionalAmount(
          latest.cash
        )} 수준으로 안정성 측면에서 참고할 수 있습니다.`,
        `재무 구조는 자본 ${formatOptionalAmount(
          latest.equity
        )}, 부채비율 ${formatOptionalPercent(
          debtRatio
        )}을 함께 보며 부담 요인을 점검하는 것이 좋습니다.`,
        `안정성은 ${
          statusTexts.stability ?? "재무 구조"
        } 관점에서 부채와 현금 보유 수준을 함께 확인할 필요가 있습니다.`,
      ])
    : "부채비율, 현금, 자본 데이터가 충분하지 않아 안정성 평가는 추가 확인이 필요합니다.";

  return [first, second, third].map((line) => line.replace(/\s+/g, " ").trim());
}

export function buildDetailAiReport(companyName: string, history: YearlyDataApi[]) {
  const sorted = sortHistory(history);
  const latest = sorted.at(-1) ?? null;
  const previous = sorted.at(-2) ?? null;

  if (!latest) return [MISSING_DATA_TEXT];

  return [
    `${companyName}의 최근 재무 데이터는 매출, 이익률, 부채 부담을 함께 확인하는 보조 자료로 활용할 수 있습니다.`,
    describeMetricChange({
      label: "매출",
      current: latest.revenue,
      previous: previous?.revenue,
      unit: "amount",
    }),
    describeMetricChange({
      label: "당기순이익",
      current: latest.net_income,
      previous: previous?.net_income,
      unit: "amount",
      allowNegative: true,
    }),
    `부채비율은 ${formatFinancialPercent(
      getDebtRatio(latest)
    )} 수준이며, 현금과 자본 흐름을 함께 점검하는 것이 필요합니다.`,
  ];
}

export function buildSummaryTextCards(history: YearlyDataApi[]): SummaryTextCard[] {
  const sorted = sortHistory(history);
  const latest = sorted.at(-1) ?? null;
  const previous = sorted.at(-2) ?? null;

  if (!latest) {
    return [{ title: "데이터 없음", content: MISSING_DATA_TEXT }];
  }

  const operatingMargin = getLatestMargin(latest, "operating_margin");
  const netMargin = getLatestMargin(latest, "net_margin");
  const revenueGrowth = calculateFinancialGrowth(
    latest.revenue,
    previous?.revenue
  );

  return [
    {
      title: "손익 요약",
      content: `${describeMetricChange({
        label: "매출",
        current: latest.revenue,
        previous: previous?.revenue,
        unit: "amount",
      })} ${describeMetricChange({
        label: "영업이익",
        current: latest.operating_profit,
        previous: previous?.operating_profit,
        unit: "amount",
        allowNegative: true,
      })}`,
    },
    {
      title: "수익성/성장률 요약",
      content: hasData(revenueGrowth, operatingMargin, netMargin)
        ? `매출 성장률 ${formatFinancialPercent(
            revenueGrowth
          )}, 영업이익률 ${formatOptionalPercent(
            operatingMargin
          )}, 순이익률 ${formatOptionalPercent(
            netMargin
          )}을 함께 보면 외형 성장과 실제 수익성의 동행 여부를 참고할 수 있습니다.`
        : "수익성/성장률 데이터가 충분하지 않아 매출, 영업이익, 순이익의 최근 흐름을 추가로 확인할 필요가 있습니다.",
    },
    {
      title: "재무 상태 요약",
      content: hasData(latest.total_assets, latest.total_liabilities, latest.equity)
        ? `자산 ${formatOptionalAmount(
            latest.total_assets
          )}, 부채 ${formatOptionalAmount(
            latest.total_liabilities
          )}, 자본 ${formatOptionalAmount(
            latest.equity
          )} 수준입니다. 자산 증가가 부채 증가에 지나치게 의존하지 않는지 점검할 필요가 있습니다.`
        : "자산, 부채, 자본 데이터가 충분하지 않아 재무 구조 해석에는 추가 자료 확인이 필요합니다.",
    },
    {
      title: "현금 요약",
      content:
        toFinancialNumber(latest.cash) !== null
          ? `현금 보유 규모는 ${formatFinancialAmount(
              latest.cash
            )} 수준입니다. 단기 유동성과 위기 대응 여력을 볼 때 다른 안정성 지표와 함께 참고할 수 있습니다.`
          : "현금 데이터가 확인되지 않아 단기 유동성 평가는 제한적입니다.",
    },
  ];
}

export function getInvestmentMetricDescription(
  metric: "roe" | "profit" | "capacity" | "growth",
  value?: NumericInput
): string {
  if (metric === "roe") {
    return toFinancialNumber(value, { allowNegative: true }) === null
      ? "ROE 계산에 필요한 순이익 또는 자본 데이터가 부족합니다."
      : "자기자본 대비 이익 창출력을 보여주는 보조 지표로, 업종 평균과 함께 참고할 수 있습니다.";
  }

  if (metric === "profit") {
    return "영업이익률과 순이익률을 함께 본 수익성 지표입니다. 일회성 손익 여부를 추가로 확인할 필요가 있습니다.";
  }

  if (metric === "capacity") {
    return "부채 부담과 현금 보유 수준을 함께 본 재무 여력 지표입니다. 낮은 부채비율만으로 안정성을 단정하지 않습니다.";
  }

  if (metric === "growth") {
    return "매출 증가가 이익 개선으로 이어지는지 확인하는 성장 흐름 지표입니다.";
  }

  return "매출과 이익 개선이 함께 이어지는지 확인하는 성장 흐름 지표입니다.";
}

export function getComparePoint(label: string) {
  const pointMap: Record<string, string> = {
    매출액:
      "기업의 외형 규모를 보여주는 지표입니다. 증가세가 이익 개선으로 이어지는지 함께 확인할 수 있습니다.",
    매출성장률:
      "성장 속도를 보여주는 지표입니다. 일회성 증가인지 지속 가능한 흐름인지 점검이 필요합니다.",
    영업이익:
      "본업에서 창출한 이익입니다. 매출 증가가 실제 영업 성과로 이어졌는지 볼 때 참고할 수 있습니다.",
    영업이익성장률:
      "본업 이익의 개선 흐름을 보여줍니다. 변동성이 큰 경우 비용 구조를 함께 확인해야 합니다.",
    당기순이익:
      "최종적으로 남는 이익입니다. 영업외손익이나 일회성 요인의 영향을 받을 수 있습니다.",
    순이익성장률:
      "최종 이익의 변화 속도입니다. 지속성 판단을 위해 여러 해의 추세를 함께 보는 것이 필요합니다.",
    영업이익률:
      "매출 대비 본업 이익률입니다. 높고 안정적으로 유지되는지 참고할 수 있습니다.",
    순이익률:
      "최종 수익성 지표입니다. 영업이익률과 차이가 큰 경우 일회성 요인을 점검할 필요가 있습니다.",
    ROE: getInvestmentMetricDescription("roe"),
    ROA: "자산 대비 이익 창출력을 보여줍니다. 자산 규모가 큰 업종은 업종 평균과 비교해 참고하는 것이 좋습니다.",
    자산총계:
      "기업의 전체 체급과 자산 기반을 보여줍니다. 수익성 지표와 함께 해석해야 합니다.",
    부채총계:
      "재무 부담을 보여주는 지표입니다. 절대 규모보다 자산, 자본, 현금과 함께 확인하는 것이 필요합니다.",
    자본총계:
      "재무 안정성과 누적 이익의 기반을 보여줍니다. 결손 또는 급감 여부를 점검할 수 있습니다.",
    부채비율:
      "자본 대비 부채 부담을 보여줍니다. 낮을수록 부담은 작지만 업종 특성을 함께 고려해야 합니다.",
    자기자본비율:
      "자산 중 자기자본이 차지하는 비중입니다. 재무 구조의 안정성 측면에서 참고할 수 있습니다.",
    현금: "단기 유동성과 대응 여력을 보여줍니다. 부채 만기와 현금흐름을 함께 확인할 필요가 있습니다.",
  };

  return (
    pointMap[label] ??
    "해당 지표는 단독으로 판단하기보다 다른 재무 항목과 함께 종합적으로 참고하는 것이 좋습니다."
  );
}

export function buildCompareReport(
  leftName: string,
  rightName: string,
  leftLatest: YearlyDataApi | null,
  rightLatest: YearlyDataApi | null
) {
  if (!leftLatest || !rightLatest) {
    return "비교 대상 중 일부의 재무 데이터가 부족해 비교 해석이 제한됩니다. 확인 가능한 지표 위주로 참고하는 것이 좋습니다.";
  }

  const leftRevenue = toFinancialNumber(leftLatest.revenue);
  const rightRevenue = toFinancialNumber(rightLatest.revenue);
  const leftDebtRatio = getDebtRatio(leftLatest);
  const rightDebtRatio = getDebtRatio(rightLatest);

  const sizeText =
    leftRevenue === null || rightRevenue === null
      ? "매출 규모 비교에는 일부 데이터가 부족합니다"
      : leftRevenue > rightRevenue
        ? `${leftName}의 매출 규모가 더 크게 확인됩니다`
        : leftRevenue < rightRevenue
          ? `${rightName}의 매출 규모가 더 크게 확인됩니다`
          : "비교 대상의 매출 규모는 유사하게 확인됩니다";

  const stabilityText =
    leftDebtRatio === null || rightDebtRatio === null
      ? "부채비율 비교는 추가 데이터 확인이 필요합니다"
      : leftDebtRatio < rightDebtRatio
        ? `${leftName}은 부채비율 측면에서 상대적으로 부담이 낮아 보입니다`
        : leftDebtRatio > rightDebtRatio
          ? `${rightName}은 부채비율 측면에서 상대적으로 부담이 낮아 보입니다`
          : "비교 대상의 부채비율은 큰 차이가 없습니다";

  return `${sizeText}. ${stabilityText}. 다만 투자 판단은 성장성, 수익성, 업종 특성, 주가 지표를 함께 확인해 보조적으로 참고하는 것이 적절합니다.`;
}

export function buildPerspectiveCards(): PerspectiveCard[] {
  return [
    {
      title: "안정형 관점",
      content:
        "자산 규모, 현금 보유 수준, 부채비율을 함께 보며 재무 부담이 과도하게 커지는지 점검할 수 있습니다.",
    },
    {
      title: "성장형 관점",
      content:
        "매출 성장률이 일회성인지, 영업이익과 순이익 개선으로 이어지는지 확인할 필요가 있습니다.",
    },
    {
      title: "수익성 관점",
      content:
        "매출 규모보다 영업이익률, 순이익률, ROE가 유지되거나 개선되는 흐름인지 참고할 수 있습니다.",
    },
    {
      title: "개선 흐름 관점",
      content:
        "최근 5개년 동안 매출, 이익, 부채비율의 방향성이 함께 개선되는지 확인하면 단기 변동을 줄여 해석할 수 있습니다.",
    },
  ];
}

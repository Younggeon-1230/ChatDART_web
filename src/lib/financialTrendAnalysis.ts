import {
  calculateDebtRatio,
  calculateProfitMargin,
  calculateROA,
  calculateROE,
  normalizePercentValue,
  pickLatestFinancialYears,
  toNumberOrNull,
} from "@/lib/financialNormalize";
import {
  OPERATING_MARGIN_SHARP_DECLINE_THRESHOLD_PERCENT_POINT,
} from "@/lib/financialInsights";
import type { YearlyDataApi } from "@/types/api";

export type MetricTrendDirection =
  | "up"
  | "down"
  | "flat"
  | "volatile"
  | "insufficient";

export type RecentMetricDirection =
  | "up"
  | "down"
  | "flat"
  | "mixed"
  | "insufficient";

export type ComprehensiveFinancialStatus =
  | "recovering"
  | "improving"
  | "stable"
  | "mixed"
  | "deteriorating"
  | "insufficient";

export type MetricTrendPoint = {
  year: number;
  value: number | null;
};

export type MetricTrendAnalysis = {
  direction: MetricTrendDirection;
  recentDirection: RecentMetricDirection;
  consecutiveYears: number;
  firstValue: number | null;
  latestValue: number | null;
  minYear: number | null;
  maxYear: number | null;
  inflectionYear?: number;
};

export type CurrentFinancialMetric = {
  key: FinancialTrendMetricKey;
  label: string;
  value: number;
  unit: "currency" | "percent";
};

export type FinancialMetricTrend = {
  key: FinancialTrendMetricKey;
  label: string;
  unit: "currency" | "percent";
  improvementDirection: "up" | "down";
  trend: MetricTrendAnalysis;
};

export type ComprehensiveFinancialAnalysis = {
  status: ComprehensiveFinancialStatus;
  statusLabel: string;
  currentYear: number | null;
  currentMetrics: CurrentFinancialMetric[];
  periodLabel: string;
  flowSummary: string;
  changes: string[];
  statusReason: string;
  basisLabel: string;
  metricTrends: FinancialMetricTrend[];
};

type FinancialTrendMetricKey =
  | "revenue"
  | "operating_profit"
  | "net_income"
  | "operating_margin"
  | "operating_cash_flow"
  | "roe"
  | "roa"
  | "debt_ratio";

type TrendValueKind = "amount" | "percentage";

type TrendComparison = {
  fromYear: number;
  toYear: number;
  fromValue: number;
  toValue: number;
  direction: "up" | "down" | "flat";
  magnitude: number;
  sharp: boolean;
};

type MetricDefinition = {
  key: FinancialTrendMetricKey;
  label: string;
  unit: "currency" | "percent";
  valueKind: TrendValueKind;
  improvementDirection: "up" | "down";
  getValue: (item: YearlyDataApi) => number | null;
};

type ChangeCandidate = {
  metricKey: FinancialTrendMetricKey;
  priority: number;
  year: number;
  text: string;
};

const STATUS_LABELS: Record<ComprehensiveFinancialStatus, string> = {
  recovering: "회복 중",
  improving: "개선 중",
  stable: "안정적",
  mixed: "혼조",
  deteriorating: "악화 중",
  insufficient: "판단 보류",
};

const AMOUNT_FLAT_THRESHOLD_PERCENT = 3;
const AMOUNT_SHARP_CHANGE_THRESHOLD_PERCENT = 20;
const PERCENTAGE_FLAT_THRESHOLD_POINT = 0.5;

function finiteNumber(value: unknown) {
  return toNumberOrNull(value, { allowNegative: true });
}

function compareMetricPoints(
  points: Array<{ year: number; value: number }>,
  valueKind: TrendValueKind
) {
  const comparisons: TrendComparison[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const delta = current.value - previous.value;
    let magnitude: number;
    let flat: boolean;
    let sharp: boolean;

    if (valueKind === "percentage") {
      magnitude = Math.abs(delta);
      flat = magnitude < PERCENTAGE_FLAT_THRESHOLD_POINT;
      sharp =
        magnitude >=
        OPERATING_MARGIN_SHARP_DECLINE_THRESHOLD_PERCENT_POINT;
    } else if (previous.value === 0) {
      magnitude = delta === 0 ? 0 : Number.POSITIVE_INFINITY;
      flat = delta === 0;
      sharp = delta !== 0;
    } else {
      magnitude = (Math.abs(delta) / Math.abs(previous.value)) * 100;
      flat = magnitude < AMOUNT_FLAT_THRESHOLD_PERCENT;
      sharp = magnitude >= AMOUNT_SHARP_CHANGE_THRESHOLD_PERCENT;
    }

    comparisons.push({
      fromYear: previous.year,
      toYear: current.year,
      fromValue: previous.value,
      toValue: current.value,
      direction: flat ? "flat" : delta > 0 ? "up" : "down",
      magnitude,
      sharp,
    });
  }

  return comparisons;
}

function getRecentDirection(comparisons: TrendComparison[]): RecentMetricDirection {
  if (comparisons.length === 0) return "insufficient";

  const recent = comparisons.slice(-2).map((item) => item.direction);
  const nonFlat = recent.filter(
    (direction): direction is "up" | "down" => direction !== "flat"
  );

  if (nonFlat.length === 0) return "flat";
  if (nonFlat.every((direction) => direction === "up")) return "up";
  if (nonFlat.every((direction) => direction === "down")) return "down";
  return "mixed";
}

function getConsecutiveYears(comparisons: TrendComparison[]) {
  const latestDirection = comparisons.at(-1)?.direction;
  if (latestDirection !== "up" && latestDirection !== "down") return 0;

  let count = 0;
  for (let index = comparisons.length - 1; index >= 0; index -= 1) {
    if (comparisons[index].direction !== latestDirection) break;
    count += 1;
  }
  return count;
}

export function analyzeMetricTrend(
  inputPoints: readonly MetricTrendPoint[],
  options: { valueKind?: TrendValueKind } = {}
): MetricTrendAnalysis {
  const points = inputPoints
    .map((point) => ({ year: Number(point.year), value: finiteNumber(point.value) }))
    .filter(
      (point): point is { year: number; value: number } =>
        Number.isFinite(point.year) && point.value !== null
    )
    .sort((a, b) => a.year - b.year);

  if (points.length < 2) {
    return {
      direction: "insufficient",
      recentDirection: "insufficient",
      consecutiveYears: 0,
      firstValue: points.at(0)?.value ?? null,
      latestValue: points.at(-1)?.value ?? null,
      minYear: points.at(0)?.year ?? null,
      maxYear: points.at(0)?.year ?? null,
    };
  }

  const comparisons = compareMetricPoints(
    points,
    options.valueKind ?? "amount"
  );
  const nonFlatDirections = comparisons
    .map((item) => item.direction)
    .filter(
      (direction): direction is "up" | "down" => direction !== "flat"
    );
  const hasUp = nonFlatDirections.includes("up");
  const hasDown = nonFlatDirections.includes("down");
  const direction: MetricTrendDirection =
    nonFlatDirections.length === 0
      ? "flat"
      : hasUp && hasDown
        ? "volatile"
        : hasUp
          ? "up"
          : "down";
  const recentDirection = getRecentDirection(comparisons);
  const consecutiveYears = getConsecutiveYears(comparisons);
  const minPoint = points.reduce((minimum, point) =>
    point.value < minimum.value ? point : minimum
  );
  const maxPoint = points.reduce((maximum, point) =>
    point.value > maximum.value ? point : maximum
  );
  let inflectionYear: number | undefined;

  if (
    recentDirection === "up" &&
    consecutiveYears >= 2 &&
    minPoint.year !== points.at(0)?.year &&
    minPoint.year !== points.at(-1)?.year
  ) {
    inflectionYear = minPoint.year;
  } else if (
    recentDirection === "down" &&
    consecutiveYears >= 2 &&
    maxPoint.year !== points.at(0)?.year &&
    maxPoint.year !== points.at(-1)?.year
  ) {
    inflectionYear = maxPoint.year;
  }

  return {
    direction,
    recentDirection,
    consecutiveYears,
    firstValue: points[0].value,
    latestValue: points.at(-1)?.value ?? null,
    minYear: minPoint.year,
    maxYear: maxPoint.year,
    ...(inflectionYear === undefined ? {} : { inflectionYear }),
  };
}

function getMetricDefinitions(isFinancialSector: boolean): MetricDefinition[] {
  if (isFinancialSector) {
    return [
      {
        key: "net_income",
        label: "당기순이익",
        unit: "currency",
        valueKind: "amount",
        improvementDirection: "up",
        getValue: (item) => finiteNumber(item.net_income),
      },
      {
        key: "roe",
        label: "ROE",
        unit: "percent",
        valueKind: "percentage",
        improvementDirection: "up",
        getValue: calculateROE,
      },
      {
        key: "roa",
        label: "ROA",
        unit: "percent",
        valueKind: "percentage",
        improvementDirection: "up",
        getValue: calculateROA,
      },
      {
        key: "debt_ratio",
        label: "부채비율",
        unit: "percent",
        valueKind: "percentage",
        improvementDirection: "down",
        getValue: calculateDebtRatio,
      },
    ];
  }

  return [
    {
      key: "revenue",
      label: "매출",
      unit: "currency",
      valueKind: "amount",
      improvementDirection: "up",
      getValue: (item) => finiteNumber(item.revenue),
    },
    {
      key: "operating_profit",
      label: "영업이익",
      unit: "currency",
      valueKind: "amount",
      improvementDirection: "up",
      getValue: (item) => finiteNumber(item.operating_profit),
    },
    {
      key: "net_income",
      label: "당기순이익",
      unit: "currency",
      valueKind: "amount",
      improvementDirection: "up",
      getValue: (item) => finiteNumber(item.net_income),
    },
    {
      key: "operating_margin",
      label: "영업이익률",
      unit: "percent",
      valueKind: "percentage",
      improvementDirection: "up",
      getValue: (item) =>
        calculateProfitMargin(item.operating_profit, item.revenue) ??
        normalizePercentValue(item.operating_margin),
    },
    {
      key: "operating_cash_flow",
      label: "영업활동현금흐름",
      unit: "currency",
      valueKind: "amount",
      improvementDirection: "up",
      getValue: (item) => finiteNumber(item.operating_cash_flow),
    },
  ];
}

function isImprovingDirection(metric: FinancialMetricTrend) {
  return metric.trend.recentDirection === metric.improvementDirection;
}

function isDeterioratingDirection(metric: FinancialMetricTrend) {
  return (
    (metric.trend.recentDirection === "up" ||
      metric.trend.recentDirection === "down") &&
    metric.trend.recentDirection !== metric.improvementDirection
  );
}

function joinLabels(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? "핵심 지표";
  return `${labels.slice(0, -1).join(", ")}과 ${labels.at(-1)}`;
}

function withTopicParticle(label: string) {
  const lastCharacter = label.at(-1) ?? "";
  const codePoint = lastCharacter.charCodeAt(0);
  const isHangulSyllable = codePoint >= 0xac00 && codePoint <= 0xd7a3;
  const hasFinalConsonant =
    isHangulSyllable && (codePoint - 0xac00) % 28 !== 0;

  return `${label}${hasFinalConsonant ? "은" : "는"}`;
}

function makeFlowSummary(
  status: ComprehensiveFinancialStatus,
  metrics: FinancialMetricTrend[],
  years: number[]
) {
  if (status === "insufficient") {
    return "장기 흐름을 판단하기에는 데이터가 부족합니다.";
  }

  const improving = metrics.filter(isImprovingDirection);
  const deteriorating = metrics.filter(isDeterioratingDirection);
  const recoveryMetric = improving.find(
    (metric) => metric.trend.inflectionYear !== undefined
  );
  const latestYear = years.at(-1);

  if (status === "recovering" && recoveryMetric && latestYear) {
    const startYear = years.at(-(recoveryMetric.trend.consecutiveYears)) ?? latestYear;
    return `${recoveryMetric.trend.inflectionYear}년 ${recoveryMetric.label} 저점 이후 ${startYear}~${latestYear}년 연속 개선되는 흐름입니다.`;
  }

  if (status === "improving") {
    return `최근 ${years.length}년 동안 ${joinLabels(
      improving.slice(0, 2).map((metric) => metric.label)
    )} 지표가 점진적으로 개선되고 있습니다.`;
  }

  if (status === "deteriorating") {
    return `최근 흐름에서 ${joinLabels(
      deteriorating.slice(0, 2).map((metric) => metric.label)
    )} 지표가 연속 또는 동반 하락해 약화가 이어지고 있습니다.`;
  }

  if (status === "mixed") {
    const positiveLabel = improving.at(0)?.label;
    const negativeLabel = deteriorating.at(0)?.label;
    if (positiveLabel && negativeLabel) {
      return `${withTopicParticle(positiveLabel)} 개선됐지만 ${withTopicParticle(
        negativeLabel
      )} 약해져 핵심 지표의 방향이 엇갈립니다.`;
    }
    return "연도별 상승과 하락이 반복돼 최근 재무 흐름은 혼조입니다.";
  }

  return `최근 ${years.length}년간 주요 재무 지표의 변동 방향이 크지 않아 비교적 안정적인 흐름입니다.`;
}

function buildChangeCandidates(
  history: YearlyDataApi[],
  definitions: MetricDefinition[],
  metrics: FinancialMetricTrend[]
) {
  const candidates: ChangeCandidate[] = [];

  definitions.forEach((definition) => {
    const points = history
      .map((item) => ({
        year: Number(item.fiscal_year),
        value: definition.getValue(item),
      }))
      .filter(
        (point): point is { year: number; value: number } =>
          Number.isFinite(point.year) && point.value !== null
      );
    const comparisons = compareMetricPoints(points, definition.valueKind);
    const metric = metrics.find((item) => item.key === definition.key);
    const isProfitMetric =
      definition.key === "operating_profit" || definition.key === "net_income";
    const supportsSignTransition =
      isProfitMetric ||
      definition.key === "operating_cash_flow" ||
      definition.key === "roe" ||
      definition.key === "roa";

    comparisons.forEach((comparison) => {
      if (
        supportsSignTransition &&
        comparison.fromValue <= 0 &&
        comparison.toValue > 0
      ) {
        candidates.push({
          metricKey: definition.key,
          priority: 120,
          year: comparison.toYear,
          text: `${comparison.toYear}년 ${definition.label}이 ${
            isProfitMetric ? "적자에서 흑자로" : "음수에서 양수로"
          } 전환됐습니다.`,
        });
      } else if (
        supportsSignTransition &&
        comparison.fromValue >= 0 &&
        comparison.toValue < 0
      ) {
        candidates.push({
          metricKey: definition.key,
          priority: 125,
          year: comparison.toYear,
          text: `${comparison.toYear}년 ${definition.label}이 ${
            isProfitMetric ? "흑자에서 적자로" : "양수에서 음수로"
          } 전환됐습니다.`,
        });
      } else if (comparison.sharp) {
        candidates.push({
          metricKey: definition.key,
          priority: 80,
          year: comparison.toYear,
          text: `${comparison.toYear}년 ${definition.label}이 전년 대비 크게 ${
            comparison.direction === "up" ? "증가" : "감소"
          }했습니다.`,
        });
      }
    });

    if (metric?.trend.inflectionYear !== undefined) {
      const latestYear = points.at(-1)?.year;
      const improving = isImprovingDirection(metric);
      if (latestYear && metric.trend.consecutiveYears >= 2) {
        const startYear = points.at(-metric.trend.consecutiveYears)?.year ?? latestYear;
        candidates.push({
          metricKey: definition.key,
          priority: improving ? 140 : 135,
          year: latestYear,
          text: `${metric.trend.inflectionYear}년 ${definition.label} ${
            improving ? "저점" : "고점"
          } 이후 ${startYear}~${latestYear}년 ${
            improving ? "회복이" : "약화가"
          } 이어졌습니다.`,
        });
      }
    }
  });

  return candidates
    .sort((a, b) => b.priority - a.priority || b.year - a.year)
    .filter(
      (candidate, index, all) =>
        all.findIndex((item) => item.text === candidate.text) === index
    )
    .slice(0, 2)
    .map((candidate) => candidate.text);
}

function classifyStatus(metrics: FinancialMetricTrend[], yearCount: number) {
  if (yearCount < 3) return "insufficient" as const;

  const usable = metrics.filter(
    (metric) => metric.trend.direction !== "insufficient"
  );
  if (usable.length < 2) return "insufficient" as const;

  const improving = usable.filter(isImprovingDirection);
  const deteriorating = usable.filter(isDeterioratingDirection);
  const recovering = improving.filter(
    (metric) =>
      metric.trend.inflectionYear !== undefined &&
      metric.trend.consecutiveYears >= 2
  );
  const volatile = usable.filter(
    (metric) =>
      metric.trend.direction === "volatile" ||
      metric.trend.recentDirection === "mixed"
  );

  if (recovering.length > 0 && improving.length > deteriorating.length) {
    return "recovering" as const;
  }
  if (
    (improving.length > 0 && deteriorating.length > 0) ||
    volatile.length >= Math.ceil(usable.length / 2)
  ) {
    return "mixed" as const;
  }
  if (deteriorating.length >= 2 && deteriorating.length > improving.length) {
    return "deteriorating" as const;
  }
  if (
    improving.length > deteriorating.length &&
    improving.some((metric) => metric.trend.consecutiveYears >= 2)
  ) {
    return "improving" as const;
  }
  return "stable" as const;
}

function makeStatusReason(
  status: ComprehensiveFinancialStatus,
  metrics: FinancialMetricTrend[]
) {
  if (status === "insufficient") {
    return "3개년 이상 유효한 핵심 지표가 확보되면 종합 상태를 판정합니다.";
  }

  const improving = metrics.filter(isImprovingDirection);
  const deteriorating = metrics.filter(isDeterioratingDirection);
  const recovering = improving.filter(
    (metric) => metric.trend.inflectionYear !== undefined
  );

  if (status === "recovering") {
    return `${joinLabels(
      recovering.map((metric) => metric.label).slice(0, 2)
    )}에서 과거 저점 뒤 2년 이상 개선이 이어졌습니다.`;
  }
  if (status === "improving") {
    return `${improving.length}개 핵심 지표에서 최근 2년 이상의 개선 방향이 확인됩니다.`;
  }
  if (status === "deteriorating") {
    return `${deteriorating.length}개 핵심 지표가 최근 하락 방향을 보여 약화 신호가 우세합니다.`;
  }
  if (status === "mixed") {
    return `개선 지표 ${improving.length}개와 약화 지표 ${deteriorating.length}개가 함께 나타납니다.`;
  }
  return "최근 방향이 뚜렷한 지표가 적고 의미 있는 변곡점도 확인되지 않습니다.";
}

export function buildComprehensiveFinancialAnalysis(
  history: readonly YearlyDataApi[],
  options: { isFinancialSector: boolean }
): ComprehensiveFinancialAnalysis {
  const latestHistory = pickLatestFinancialYears([...history], 5);
  const definitions = getMetricDefinitions(options.isFinancialSector);
  const years = latestHistory.map((item) => Number(item.fiscal_year));
  const latest = latestHistory.at(-1) ?? null;
  const metricTrends = definitions.map<FinancialMetricTrend>((definition) => ({
    key: definition.key,
    label: definition.label,
    unit: definition.unit,
    improvementDirection: definition.improvementDirection,
    trend: analyzeMetricTrend(
      latestHistory.map((item) => ({
        year: Number(item.fiscal_year),
        value: definition.getValue(item),
      })),
      { valueKind: definition.valueKind }
    ),
  }));
  const status = classifyStatus(metricTrends, latestHistory.length);
  const currentMetrics = latest
    ? definitions
        .map((definition) => ({
          key: definition.key,
          label: definition.label,
          value: definition.getValue(latest),
          unit: definition.unit,
        }))
        .filter(
          (metric): metric is CurrentFinancialMetric => metric.value !== null
        )
        .slice(0, 4)
    : [];

  return {
    status,
    statusLabel: STATUS_LABELS[status],
    currentYear: latest ? Number(latest.fiscal_year) : null,
    currentMetrics,
    periodLabel:
      latestHistory.length > 0
        ? `최근 ${latestHistory.length}개년`
        : "최근 5개년",
    flowSummary: makeFlowSummary(status, metricTrends, years),
    changes:
      status === "insufficient"
        ? []
        : buildChangeCandidates(latestHistory, definitions, metricTrends),
    statusReason: makeStatusReason(status, metricTrends),
    basisLabel: options.isFinancialSector
      ? "금융업 기준으로 분석"
      : "비금융업 기준으로 분석",
    metricTrends,
  };
}

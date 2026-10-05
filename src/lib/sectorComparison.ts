import type { SectorAverageApi } from "@/types/api";

export type SectorComparisonMetricKey =
  | "revenue_growth_rate"
  | "operating_margin"
  | "net_margin"
  | "roe"
  | "roa"
  | "debt_ratio";

export type SectorComparisonItem = {
  key: SectorComparisonMetricKey;
  label: string;
  companyValue: number;
  sectorAverage: number;
  signed: boolean;
  rank: number | null;
  totalCompanies: number | null;
};

type CompanySectorMetrics = Partial<
  Record<SectorComparisonMetricKey, number | null | undefined>
>;

type BuildSectorComparisonInput = {
  companyMetrics: CompanySectorMetrics;
  sectorAverage?: SectorAverageApi | null;
  sectorRank?: unknown;
  isFinancialSector: boolean;
};

type MetricDefinition = {
  key: SectorComparisonMetricKey;
  label: string;
  signed?: boolean;
  rankKeys: string[];
};

const GENERAL_METRICS: MetricDefinition[] = [
  {
    key: "revenue_growth_rate",
    label: "매출 성장률",
    signed: true,
    rankKeys: ["revenue_growth_rank", "revenueGrowthRank", "revenue_rank", "revenueRank"],
  },
  {
    key: "operating_margin",
    label: "영업이익률",
    rankKeys: ["operating_margin_rank", "operatingMarginRank"],
  },
  {
    key: "net_margin",
    label: "순이익률",
    rankKeys: ["net_margin_rank", "netMarginRank"],
  },
  { key: "roe", label: "ROE", rankKeys: ["roe_rank", "roeRank"] },
  { key: "roa", label: "ROA", rankKeys: ["roa_rank", "roaRank"] },
  {
    key: "debt_ratio",
    label: "부채비율",
    rankKeys: ["debt_ratio_rank", "debtRatioRank"],
  },
];

const FINANCIAL_METRIC_KEYS = new Set<SectorComparisonMetricKey>([
  "roe",
  "roa",
  "debt_ratio",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getPositiveInteger(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : Number.NaN;

    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }

  return null;
}

export function buildSectorComparisonItems({
  companyMetrics,
  sectorAverage,
  sectorRank,
  isFinancialSector,
}: BuildSectorComparisonInput): SectorComparisonItem[] {
  if (!sectorAverage) return [];

  const rankRecord = isRecord(sectorRank) ? sectorRank : {};
  const totalCompanies = getPositiveInteger(rankRecord, [
    "total_companies",
    "totalCompanies",
  ]);
  const definitions = isFinancialSector
    ? GENERAL_METRICS.filter((metric) => FINANCIAL_METRIC_KEYS.has(metric.key))
    : GENERAL_METRICS;

  return definitions.flatMap((metric) => {
    const companyValue = getFiniteNumber(companyMetrics[metric.key]);
    const sectorAverageValue = getFiniteNumber(sectorAverage[metric.key]);

    if (companyValue === null || sectorAverageValue === null) return [];

    const rank = getPositiveInteger(rankRecord, metric.rankKeys);

    return [
      {
        key: metric.key,
        label: metric.label,
        companyValue,
        sectorAverage: sectorAverageValue,
        signed: metric.signed === true,
        rank,
        totalCompanies:
          rank !== null && totalCompanies !== null && totalCompanies >= rank
            ? totalCompanies
            : null,
      },
    ];
  });
}

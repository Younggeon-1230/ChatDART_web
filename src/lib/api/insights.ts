import type {
  FinancialDisclosuresResponseApi,
  InsightInterpretationFlagApi,
  InsightPrimaryFlagApi,
  InsightInterpretationRequestApi,
  InsightInterpretationResponseApi,
} from "@/types/api";
import type { FinancialInsight } from "@/lib/financialInsights";
import { ApiParseError, authorizedApiRequest } from "@/lib/api/client";
import { AI_ANALYSIS_TIMEOUT_MS } from "@/lib/api/finance";
import { isRecord } from "@/lib/financialNormalize";

export type InsightInterpretationRequestInput = {
  stockCode: string;
  company: string;
  latestYear: string | number;
  insights: readonly FinancialInsight[];
};

function toFiniteEvidenceNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function toCanonicalChangeRate(value: unknown) {
  const finiteValue = toFiniteEvidenceNumber(value);

  if (finiteValue === undefined) return undefined;

  const magnitude = Math.abs(finiteValue);
  const roundedMagnitude =
    Math.round(
      (magnitude + Number.EPSILON * Math.max(1, magnitude)) * 100
    ) / 100;

  return finiteValue < 0 ? -roundedMagnitude : roundedMagnitude;
}

function mapInsightFlag(
  insight: FinancialInsight
): InsightInterpretationFlagApi {
  const evidence = Array.isArray(insight.evidence) ? insight.evidence : [];

  return {
    id: insight.id,
    year: insight.year,
    title: insight.title,
    evidence: evidence.flatMap((item) => {
      if (!item || typeof item.label !== "string") return [];

      const currentValue = toFiniteEvidenceNumber(item.currentValue);

      if (currentValue === undefined) return [];

      const previousValue = toFiniteEvidenceNumber(item.previousValue);
      const changeRate = toCanonicalChangeRate(item.changeRate);

      return [
        {
          label: item.label,
          currentValue,
          ...(item.previousValue === null
            ? { previousValue: null }
            : previousValue === undefined
              ? {}
              : { previousValue }),
          ...(item.changeRate === null
            ? { changeRate: null }
            : changeRate === undefined
              ? {}
              : { changeRate }),
        },
      ];
    }),
  };
}

export function mapFinancialInsightsToInterpretationFlags(
  insights: readonly FinancialInsight[]
): Pick<
  InsightInterpretationRequestApi,
  "warning_flags" | "positive_flags"
> {
  const seenIds = new Set<string>();
  const warningFlags: InsightInterpretationFlagApi[] = [];
  const positiveFlags: InsightInterpretationFlagApi[] = [];

  insights.forEach((insight) => {
    if (seenIds.has(insight.id)) {
      return;
    }

    seenIds.add(insight.id);
    const flag = mapInsightFlag(insight);

    if (insight.type === "warning") {
      warningFlags.push(flag);
    } else {
      positiveFlags.push(flag);
    }
  });

  return {
    warning_flags: warningFlags,
    positive_flags: positiveFlags,
  };
}

export function buildInsightInterpretationRequest({
  stockCode,
  company,
  latestYear,
  insights,
}: InsightInterpretationRequestInput): InsightInterpretationRequestApi {
  return {
    stock_code: stockCode,
    company,
    latest_year: latestYear,
    ...mapFinancialInsightsToInterpretationFlags(insights),
  };
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

export function getInsightInterpretationRequestKey(
  input: InsightInterpretationRequestInput
): string | null {
  const payload = buildInsightInterpretationRequest(input);

  if (
    payload.warning_flags.length === 0 &&
    payload.positive_flags.length === 0
  ) {
    return null;
  }

  const toKeyFlag = (flag: InsightInterpretationFlagApi) => ({
    id: flag.id,
    evidence: flag.evidence
      .map((item) => ({ ...item }))
      .sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b))),
  });

  return stableSerialize({
    stock_code: payload.stock_code.trim(),
    latest_year: String(payload.latest_year),
    warning_flags: payload.warning_flags.map(toKeyFlag),
    positive_flags: payload.positive_flags.map(toKeyFlag),
  });
}

function normalizeInsightPrimaryFlag(
  value: unknown
): InsightPrimaryFlagApi | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.year !== "number" ||
    !Number.isFinite(value.year)
  ) {
    return null;
  }

  return {
    id: value.id,
    year: value.year,
  };
}

function normalizeInsightInterpretationResponse(
  response: unknown,
  fallbackStockCode: string
): InsightInterpretationResponseApi {
  if (!isRecord(response)) {
    throw new ApiParseError("api", JSON.stringify(response));
  }

  const stockCode =
    typeof response.stock_code === "string" && response.stock_code.trim()
      ? response.stock_code.trim()
      : fallbackStockCode;
  const interpretationAvailable = response.interpretation_available === true;
  const primaryFlag = normalizeInsightPrimaryFlag(response.primary_flag);

  if (!interpretationAvailable || !isRecord(response.interpretation)) {
    return {
      stock_code: stockCode,
      interpretation: null,
      interpretation_available: interpretationAvailable,
      primary_flag: primaryFlag,
    };
  }

  const interpretation = response.interpretation;

  return {
    stock_code: stockCode,
    interpretation: {
      headline:
        typeof interpretation.headline === "string"
          ? interpretation.headline
          : "",
      positive:
        typeof interpretation.positive === "string"
          ? interpretation.positive
          : null,
      caution:
        typeof interpretation.caution === "string"
          ? interpretation.caution
          : null,
      check_items: Array.isArray(interpretation.check_items)
        ? interpretation.check_items.filter(
            (item): item is string => typeof item === "string"
          )
        : [],
    },
    interpretation_available: true,
    primary_flag: primaryFlag,
  };
}

export async function interpretFinancialInsights(
  input: InsightInterpretationRequestInput
): Promise<InsightInterpretationResponseApi | null> {
  const payload = buildInsightInterpretationRequest(input);

  if (
    payload.warning_flags.length === 0 &&
    payload.positive_flags.length === 0
  ) {
    return null;
  }

  const response = await authorizedApiRequest<unknown>(
    "/finance/insights/interpret",
    {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: AI_ANALYSIS_TIMEOUT_MS,
    }
  );

  return normalizeInsightInterpretationResponse(response, payload.stock_code);
}

export type FinancialDisclosuresRequestInput = {
  stockCode: string;
  insights: readonly FinancialInsight[];
};

export function selectDisclosureRuleId(
  insights: readonly FinancialInsight[]
): string | null {
  const selectedInsight =
    insights.find((insight) => insight.type === "warning") ??
    insights.find((insight) => insight.type === "positive");

  return selectedInsight?.id ?? null;
}

function buildDisclosuresQuery(stockCode: string, ruleId: string) {
  const searchParams = new URLSearchParams();

  if (stockCode !== "") {
    searchParams.set("stock_code", stockCode);
  }

  if (ruleId !== "") {
    searchParams.set("rule_id", ruleId);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function getFinancialDisclosures({
  stockCode,
  insights,
}: FinancialDisclosuresRequestInput): Promise<FinancialDisclosuresResponseApi | null> {
  const ruleId = selectDisclosureRuleId(insights);

  if (!ruleId) return null;

  const normalizedStockCode = stockCode.trim();

  if (!/^\d{6}$/.test(normalizedStockCode)) {
    throw new Error("stockCode must be a 6-digit stock code.");
  }

  return authorizedApiRequest<FinancialDisclosuresResponseApi>(
    `/finance/disclosures${buildDisclosuresQuery(
      normalizedStockCode,
      ruleId
    )}`
  );
}

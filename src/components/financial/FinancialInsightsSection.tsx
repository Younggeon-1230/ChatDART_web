import { AlertTriangle, TrendingUp } from "lucide-react";
import { StatusBadge } from "@/components/common/Badge";
import Box from "@/components/financial/Box";
import SectionLabel from "@/components/financial/SectionLabel";
import { cn } from "@/lib/classNames";
import {
  formatPercent,
  formatRatio,
  formatSignedPercent,
  type NumericValue,
} from "@/lib/format";
import {
  sortFinancialInsightCardsForDisplay,
  type FinancialInsight,
  type FinancialInsightEvidence,
  type FinancialInsightType,
} from "@/lib/financialInsights";

type FinancialInsightsSectionProps = {
  insights: FinancialInsight[];
  currencyFormatter: (value: NumericValue) => string;
};

type InsightCardConfig = {
  label: string;
  tone: "warning" | "success";
  icon: typeof AlertTriangle;
};

const INSIGHT_TYPE_CONFIG: Record<FinancialInsightType, InsightCardConfig> = {
  warning: {
    label: "주의해서 볼 흐름",
    tone: "warning",
    icon: AlertTriangle,
  },
  positive: {
    label: "긍정적으로 볼 흐름",
    tone: "success",
    icon: TrendingUp,
  },
};

function formatRatioValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${formatRatio(value, 1)}배`;
}

function formatEvidenceValue(
  evidence: FinancialInsightEvidence,
  value: number | null | undefined,
  currencyFormatter: (value: NumericValue) => string
) {
  if (evidence.unit === "currency") return currencyFormatter(value);
  if (evidence.unit === "percent") {
    return formatPercent(value, evidence.displayFractionDigits ?? 1);
  }
  if (evidence.unit === "ratio") return formatRatioValue(value);
  return value === null || value === undefined || !Number.isFinite(value)
    ? "-"
    : String(value);
}

function formatEvidenceChange(evidence: FinancialInsightEvidence) {
  const value = evidence.changeRate;

  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  if (evidence.unit === "percent") {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%p`;
  }

  if (evidence.unit === "ratio") {
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatRatio(value, 1)}배`;
  }

  return formatSignedPercent(value, 1);
}

function InsightEvidenceList({
  evidence,
  currencyFormatter,
}: {
  evidence: FinancialInsightEvidence[];
  currencyFormatter: (value: NumericValue) => string;
}) {
  if (evidence.length === 0) return null;

  return (
    <dl className="mt-4 grid gap-2">
      {evidence.map((item) => {
        const currentValue = formatEvidenceValue(
          item,
          item.currentValue,
          currencyFormatter
        );
        const previousValue =
          "previousValue" in item
            ? formatEvidenceValue(item, item.previousValue, currencyFormatter)
            : null;
        const change = formatEvidenceChange(item);

        return (
          <div
            key={`${item.label}-${currentValue}-${previousValue ?? "current"}`}
            className="min-w-0 rounded-lg border border-slate-200 bg-white/80 px-3 py-2"
          >
            <dt className="text-xs font-medium text-slate-500">
              {item.label}
            </dt>
            <dd className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-slate-900">
              {previousValue !== null ? (
                <>
                  <span className="break-words text-slate-500">
                    전년 {previousValue}
                  </span>
                  <span className="text-slate-300" aria-hidden="true">
                    →
                  </span>
                  <span className="break-words">현재 {currentValue}</span>
                </>
              ) : (
                <span className="break-words">{currentValue}</span>
              )}
              {change && (
                <span
                  className={cn(
                    "rounded-lg px-2 py-0.5 text-xs",
                    change.startsWith("-")
                      ? "bg-rose-50 text-rose-700"
                      : "bg-emerald-50 text-emerald-700"
                  )}
                >
                  {change}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function FinancialInsightCard({
  insight,
  group,
  currencyFormatter,
}: {
  insight: FinancialInsight;
  group: InsightCardConfig;
  currencyFormatter: (value: NumericValue) => string;
}) {
  const Icon = group.icon;
  const isWarning = insight.type === "warning";

  return (
    <li
      className={cn(
        "min-w-0 rounded-lg border bg-white/90 p-4 shadow-sm",
        isWarning
          ? "border-amber-200 shadow-amber-100/50"
          : "border-emerald-200 shadow-emerald-100/50"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
            isWarning
              ? "bg-amber-50 text-amber-700 ring-amber-200"
              : "bg-emerald-50 text-emerald-700 ring-emerald-200"
          )}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={group.tone}>{group.label}</StatusBadge>
            <span className="text-xs font-medium text-slate-500">
              기준 연도 {insight.year}
            </span>
          </div>
          <h4 className="mt-3 break-words text-base font-semibold leading-6 text-slate-950">
            {insight.title}
          </h4>
          <p className="mt-2 break-words text-sm leading-6 text-slate-600">
            {insight.description}
          </p>
          <InsightEvidenceList
            evidence={insight.evidence}
            currencyFormatter={currencyFormatter}
          />
        </div>
      </div>
    </li>
  );
}

export default function FinancialInsightsSection({
  insights,
  currencyFormatter,
}: FinancialInsightsSectionProps) {
  if (insights.length === 0) return null;

  const insightsByYear = sortFinancialInsightCardsForDisplay(insights).reduce<
    Array<{ year: FinancialInsight["year"]; insights: FinancialInsight[] }>
  >((groups, insight) => {
    const currentGroup = groups.at(-1);

    if (currentGroup && String(currentGroup.year) === String(insight.year)) {
      currentGroup.insights.push(insight);
    } else {
      groups.push({ year: insight.year, insights: [insight] });
    }

    return groups;
  }, []);

  return (
    <Box className="p-4 sm:p-6">
      <SectionLabel>실적 해석 포인트</SectionLabel>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        최근 재무 흐름을 규칙 기반으로 분석한 참고 정보입니다. 실제 원인은 세부 재무 항목과 공시 내용을 함께 확인해야 합니다.
      </p>

      <div className="mt-5 space-y-7">
        {insightsByYear.map(({ year, insights: yearInsights }) => (
          <section key={String(year)} aria-labelledby={`insights-${year}`}>
            <div className="flex items-center gap-3">
              <h3
                id={`insights-${year}`}
                className="inline-flex shrink-0 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-base font-bold text-blue-950"
              >
                {String(year).endsWith("년") ? year : `${year}년`}
              </h3>
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            </div>

            <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {yearInsights.map((insight) => (
                <FinancialInsightCard
                  key={`${insight.type}-${insight.id}-${insight.year}`}
                  insight={insight}
                  group={INSIGHT_TYPE_CONFIG[insight.type]}
                  currencyFormatter={currencyFormatter}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Box>
  );
}

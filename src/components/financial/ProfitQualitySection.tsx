import { AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/common/Badge";
import Box from "@/components/financial/Box";
import SectionLabel from "@/components/financial/SectionLabel";
import { cn } from "@/lib/classNames";
import {
  formatRatio,
  formatSignedPercent,
  type NumericValue,
} from "@/lib/format";
import type {
  FinancialInsight,
  FinancialInsightEvidence,
} from "@/lib/financialInsights";

type ProfitQualitySectionProps = {
  insights: FinancialInsight[];
  currencyFormatter: (value: NumericValue) => string;
};

function isMissingNumber(
  value: number | null | undefined
): value is null | undefined {
  return value === null || value === undefined || !Number.isFinite(value);
}

function formatPercentValue(value: number | null | undefined) {
  if (isMissingNumber(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatRatioValue(value: number | null | undefined) {
  if (isMissingNumber(value)) return "-";
  return `${formatRatio(value, 1)}배`;
}

function formatEvidenceValue(
  evidence: FinancialInsightEvidence,
  value: number | null | undefined,
  currencyFormatter: (value: NumericValue) => string
) {
  if (evidence.unit === "currency") return currencyFormatter(value);
  if (evidence.unit === "percent") return formatPercentValue(value);
  if (evidence.unit === "ratio") return formatRatioValue(value);
  return isMissingNumber(value) ? "-" : String(value);
}

function formatEvidenceChange(evidence: FinancialInsightEvidence) {
  const value = evidence.changeRate;

  if (isMissingNumber(value)) return null;

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

function ProfitQualityEvidence({
  evidence,
  currencyFormatter,
}: {
  evidence: FinancialInsightEvidence[];
  currencyFormatter: (value: NumericValue) => string;
}) {
  const visibleEvidence = evidence.filter(
    (item) =>
      !isMissingNumber(item.currentValue) ||
      ("previousValue" in item && !isMissingNumber(item.previousValue))
  );

  if (visibleEvidence.length === 0) return null;

  return (
    <dl className="mt-4 grid gap-2">
      {visibleEvidence.map((item) => {
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
            className="min-w-0 rounded-lg border border-amber-100 bg-white/85 px-3 py-2"
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

function ProfitQualityCard({
  insight,
  currencyFormatter,
}: {
  insight: FinancialInsight;
  currencyFormatter: (value: NumericValue) => string;
}) {
  return (
    <li className="min-w-0 rounded-lg border border-amber-200 bg-white/90 p-4 shadow-sm shadow-amber-100/50">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200"
          aria-hidden="true"
        >
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="warning">확인 필요</StatusBadge>
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
          <ProfitQualityEvidence
            evidence={insight.evidence}
            currencyFormatter={currencyFormatter}
          />
        </div>
      </div>
    </li>
  );
}

export default function ProfitQualitySection({
  insights,
  currencyFormatter,
}: ProfitQualitySectionProps) {
  if (insights.length === 0) return null;

  return (
    <Box className="p-4 sm:p-6">
      <SectionLabel>이익의 질 점검</SectionLabel>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        순이익과 영업이익의 차이를 통해 본업의 수익성과 이익 구성의 흐름을 점검합니다.
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-400">
        이 결과는 정형 재무 수치에 기반한 참고 정보이며, 실제 원인은 영업외손익과 공시 내용을 함께 확인해야 합니다.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <StatusBadge tone="warning">확인 필요</StatusBadge>
        <span className="text-sm text-slate-500">
          순이익과 영업이익의 괴리 신호 {insights.length}개
        </span>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {insights.map((insight) => (
          <ProfitQualityCard
            key={`${insight.id}-${insight.year}`}
            insight={insight}
            currencyFormatter={currencyFormatter}
          />
        ))}
      </ul>
      <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-800">
        위 신호는 원인을 확정하지 않습니다. 영업외손익, 일회성 항목, 현금흐름, 공시 내용을 함께 확인하는 참고 지표로 활용해 주세요.
      </p>
    </Box>
  );
}

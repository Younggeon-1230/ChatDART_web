import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import Box from "@/components/financial/Box";
import SectionLabel from "@/components/financial/SectionLabel";
import {
  resolveAiAnalysisNarrative,
  resolvePredictionDisplayText,
} from "@/lib/aiAnalysisPresentation";
import { formatKRW } from "@/lib/format";
import type { AiAnalysisResponse } from "@/types/api";

export type AiReportStatus = "disabled" | "loading" | "success" | "error";

type AiReportSlotProps = {
  title?: string;
  description?: string;
  analysis?: AiAnalysisResponse | null;
  enabled?: boolean;
  status?: AiReportStatus;
  errorText?: string;
};

function isValidPredictionValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizePredictionLabel(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "이익";
}

function formatPredictionDisplay(
  value: unknown,
  label: unknown,
  displayText: string | null
) {
  if (!displayText && !isValidPredictionValue(value)) {
    return null;
  }

  return {
    labelText: `다음해 예측 ${normalizePredictionLabel(label)}`,
    valueText: displayText ?? formatKRW(value as number),
    helperText: "AI 모델 기반 추정값입니다.",
  };
}

export default function AiReportSlot({
  title = "AI 분석 리포트",
  description = "최근 5개년 재무 데이터를 바탕으로 핵심 흐름과 예측 정보를 제공합니다.",
  analysis = null,
  enabled = false,
  status,
  errorText = "",
}: AiReportSlotProps) {
  const narrative = resolveAiAnalysisNarrative(analysis);
  const predictionDisplay = formatPredictionDisplay(
    analysis?.prediction,
    analysis?.prediction_label,
    resolvePredictionDisplayText(analysis)
  );
  const hasNarrative = !!narrative;
  const hasPrediction = !!predictionDisplay;
  const resolvedStatus: AiReportStatus =
    status ??
    (analysis && (hasNarrative || hasPrediction)
      ? "success"
      : "disabled");
  const isLoading = resolvedStatus === "loading";
  const isError = resolvedStatus === "error";
  const hasAnalysis =
    resolvedStatus === "success" &&
    !!analysis &&
    (hasNarrative || hasPrediction);
  const badgeText = enabled
    ? isLoading
      ? "분석 중"
      : isError
        ? "오류"
        : hasAnalysis
          ? "분석 완료"
          : "이용 안내"
    : "이용 안내";

  return (
    <Box className="max-w-full overflow-x-hidden border-dashed border-sky-200 bg-white/80 p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 ring-1 ring-slate-200">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isError ? (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <SectionLabel>{title}</SectionLabel>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
              {badgeText}
            </span>
          </div>

          {isLoading ? (
            <p className="mt-2 max-w-full break-words text-sm leading-relaxed text-slate-500">
              AI 분석 결과를 불러오는 중입니다. 잠시만 기다려 주세요.
            </p>
          ) : isError ? (
            <div className="mt-3 max-w-full rounded-lg border border-red-100 bg-red-50 px-3 py-3">
              <p className="break-words text-sm leading-relaxed text-red-700">
                {errorText || "AI 분석 결과를 불러오지 못했습니다."}
              </p>
            </div>
          ) : hasAnalysis ? (
            <div className="mt-3 min-w-0 max-w-full space-y-4 overflow-hidden">
              {narrative && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">
                    {narrative.label}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                    {narrative.text}
                  </p>
                </div>
              )}

              {predictionDisplay && (
                <div className="max-w-full rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-3">
                  <p className="text-xs font-semibold text-blue-700">
                    {predictionDisplay.labelText}
                  </p>
                  <p className="mt-1 break-words text-base font-semibold text-blue-950">
                    {predictionDisplay.valueText}
                  </p>
                  <p className="mt-1 break-words text-xs leading-relaxed text-slate-500">
                    {predictionDisplay.helperText}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 max-w-full whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>
    </Box>
  );
}

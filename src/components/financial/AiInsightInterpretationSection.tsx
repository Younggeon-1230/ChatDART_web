import { AlertTriangle, CheckCircle2, ListChecks, Sparkles } from "lucide-react";
import { StatusState } from "@/components/common/StatusState";
import Box from "@/components/financial/Box";
import SectionLabel from "@/components/financial/SectionLabel";
import type { InsightInterpretationApi } from "@/types/api";
import type { AsyncSectionStatus } from "@/types/asyncSection";

export type AiInsightInterpretationStatus = Exclude<
  AsyncSectionStatus,
  "empty"
>;

type AiInsightInterpretationSectionProps = {
  status: AiInsightInterpretationStatus;
  interpretation: InsightInterpretationApi | null;
  errorText?: string;
};

export default function AiInsightInterpretationSection({
  status,
  interpretation,
  errorText = "",
}: AiInsightInterpretationSectionProps) {
  if (status === "idle") return null;

  return (
    <Box className="max-w-full overflow-hidden p-4 sm:p-6">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-100"
          aria-hidden="true"
        >
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <SectionLabel>AI 해석 포인트</SectionLabel>
          <p className="mt-1 break-words text-xs leading-5 text-slate-500">
            규칙 기반 신호를 AI가 요약한 참고 정보입니다.
          </p>
        </div>
      </div>

      {status === "loading" ? (
        <StatusState
          variant="loading"
          title="AI 해석을 불러오는 중입니다."
          description="기존 규칙 분석은 그대로 확인할 수 있습니다."
          compact
          className="mt-5"
        />
      ) : status === "fallback" ? (
        <StatusState
          variant="info"
          title="현재 AI 해석을 제공할 수 없습니다."
          description="규칙 기반 해석 포인트를 참고해 주세요."
          compact
          className="mt-5"
        />
      ) : status === "error" ? (
        <StatusState
          variant="error"
          title="AI 해석을 불러오지 못했습니다."
          description={errorText || "잠시 후 다시 확인해 주세요."}
          compact
          className="mt-5"
        />
      ) : interpretation ? (
        <div className="mt-5 min-w-0 space-y-4">
          <p className="whitespace-pre-wrap break-words text-base font-semibold leading-7 text-slate-950">
            {interpretation.headline}
          </p>

          {interpretation.positive !== null && (
            <section className="min-w-0 rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                긍정적으로 볼 점
              </h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {interpretation.positive}
              </p>
            </section>
          )}

          {interpretation.caution !== null && (
            <section className="min-w-0 rounded-lg border border-amber-100 bg-amber-50/50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                주의해서 볼 점
              </h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {interpretation.caution}
              </p>
            </section>
          )}

          {interpretation.check_items.length > 0 && (
            <section className="min-w-0 rounded-lg border border-sky-100 bg-sky-50/50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                <ListChecks className="h-4 w-4 shrink-0" aria-hidden="true" />
                추가 확인 항목
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {interpretation.check_items.slice(0, 5).map((item, index) => (
                  <li
                    key={`${index}-${item}`}
                    className="flex min-w-0 items-start gap-2"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
                    <span className="min-w-0 whitespace-pre-wrap break-words">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : null}
    </Box>
  );
}

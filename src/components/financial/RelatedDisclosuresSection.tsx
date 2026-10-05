import { ExternalLink, FileText } from "lucide-react";
import { StatusState } from "@/components/common/StatusState";
import Box from "@/components/financial/Box";
import SectionLabel from "@/components/financial/SectionLabel";
import { selectRelatedDisclosures } from "@/lib/financialDisclosures";
import type { FinancialDisclosureApi } from "@/types/api";
import type { AsyncSectionStatus } from "@/types/asyncSection";

export type RelatedDisclosuresStatus = Exclude<
  AsyncSectionStatus,
  "fallback"
>;

type RelatedDisclosuresSectionProps = {
  status: RelatedDisclosuresStatus;
  disclosures: FinancialDisclosureApi[];
  errorText?: string;
};

export function getDisclosureCategoryLabel(category: string): string {
  switch (category) {
    case "periodic":
      return "정기공시";
    case "performance":
      return "실적공시";
    case "major":
      return "주요사항";
    case "other":
    default:
      return "기타";
  }
}

function getDisclosureDate(value: unknown) {
  if (typeof value !== "string") return "";

  const normalized = value.trim();
  return normalized && !Number.isNaN(Date.parse(normalized)) ? normalized : "";
}

function getDisclosureSubmitter(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export default function RelatedDisclosuresSection({
  status,
  disclosures,
  errorText = "",
}: RelatedDisclosuresSectionProps) {
  if (
    status === "idle" ||
    status === "empty" ||
    (status === "success" && disclosures.length === 0)
  ) {
    return null;
  }

  const visibleDisclosures = selectRelatedDisclosures(disclosures);

  return (
    <Box className="max-w-full overflow-hidden p-4 sm:p-6">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-blue-700 ring-1 ring-sky-100"
          aria-hidden="true"
        >
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <SectionLabel>관련 공시</SectionLabel>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            대표 재무 신호와 관련된 DART 공시를 확인합니다.
          </p>
        </div>
      </div>

      {status === "loading" ? (
        <StatusState
          variant="loading"
          title="관련 공시를 불러오는 중입니다."
          compact
          className="mt-5"
        />
      ) : status === "error" ? (
        <StatusState
          variant="error"
          title="관련 공시를 불러오지 못했습니다."
          description={errorText || "잠시 후 다시 확인해 주세요."}
          compact
          className="mt-5"
        />
      ) : (
        <ul className="mt-5 grid gap-3">
          {visibleDisclosures.map((disclosure) => {
            const date = getDisclosureDate(disclosure.date);
            const submitter = getDisclosureSubmitter(disclosure.submitter);

            return (
              <li
                key={`${disclosure.viewer_url}-${disclosure.date}-${disclosure.title}`}
                className="min-w-0 rounded-lg border border-slate-200 bg-white px-4 py-4"
              >
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-sky-100">
                      {getDisclosureCategoryLabel(disclosure.category)}
                    </span>
                    {date && (
                      <span className="break-words text-xs text-slate-500">
                        {date}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 break-words text-sm font-semibold leading-6 text-slate-950">
                    {disclosure.title}
                  </h3>
                  {submitter && (
                    <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                      제출인 {submitter}
                    </p>
                  )}
                </div>

                <a
                  href={disclosure.viewer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  원문 보기
                  <span className="sr-only">(새 탭)</span>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
              </li>
            );
          })}
        </ul>
      )}
    </Box>
  );
}

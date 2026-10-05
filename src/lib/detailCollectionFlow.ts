import { getApiErrorStatus } from "@/lib/apiErrors";
import type { CompanyAnalysisTarget } from "@/lib/companySearch";
import type { SummaryDetailApiResponse } from "@/types/api";

const COLLECTION_REQUIRED_DETAIL_MESSAGE = "데이터 수집이 필요합니다.";

type ErrorWithUserMessage = {
  userMessage?: unknown;
};

export type DetailCollectionProbeResult =
  | { kind: "detail"; detail: SummaryDetailApiResponse }
  | { kind: "needs_collection"; message: string };

export function isDetailCollectionRequiredError(error: unknown) {
  const userMessage = (error as ErrorWithUserMessage)?.userMessage;

  return (
    getApiErrorStatus(error) === 404 &&
    typeof userMessage === "string" &&
    userMessage.trim() === COLLECTION_REQUIRED_DETAIL_MESSAGE
  );
}

export async function probeDetailCollectionState(
  target: CompanyAnalysisTarget,
  getSummaryDetail: (
    target: CompanyAnalysisTarget
  ) => Promise<SummaryDetailApiResponse>
): Promise<DetailCollectionProbeResult> {
  try {
    return {
      kind: "detail",
      detail: await getSummaryDetail(target),
    };
  } catch (error) {
    if (!isDetailCollectionRequiredError(error)) {
      throw error;
    }

    return {
      kind: "needs_collection",
      message: COLLECTION_REQUIRED_DETAIL_MESSAGE,
    };
  }
}

import { getApiErrorStatus } from "@/lib/apiErrors";
import type { CompanyAnalysisTarget } from "@/lib/companySearch";
import type {
  CollectResponseApi,
  CollectionStatusResponseApi,
  SummaryDetailApiResponse,
} from "@/types/api";

export type SummaryCollectionProbeResult =
  | { kind: "completed"; detail: SummaryDetailApiResponse }
  | { kind: "needs_collection"; message?: string | null }
  | {
      kind: "pending";
      status: "pending" | "processing";
      message?: string | null;
      collectionUpdatedAt?: string | null;
    }
  | { kind: "retry_detail"; message?: string | null }
  | { kind: "failed"; message?: string | null };

export type SummaryPollResult =
  | "completed"
  | "needs_collection"
  | "pending"
  | "failed"
  | "error"
  | "timeout";

export type InitialSummaryAction = "stop" | "poll" | "collect";

export function getInitialSummaryAction(
  result: SummaryPollResult
): InitialSummaryAction {
  if (result === "needs_collection") return "collect";
  if (result === "pending") return "poll";
  return "stop";
}

export function isTerminalSummaryPollResult(result: SummaryPollResult) {
  return (
    result === "completed" ||
    result === "failed" ||
    result === "error" ||
    result === "timeout"
  );
}

type CollectionRetryLock = { current: boolean };

export type FailedCollectionRetryResult =
  | { kind: "accepted"; response: CollectResponseApi }
  | { kind: "skipped" };

export async function retryFailedSummaryCollection(
  target: CompanyAnalysisTarget,
  startCollection: (
    target: CompanyAnalysisTarget
  ) => Promise<CollectResponseApi>,
  lock: CollectionRetryLock
): Promise<FailedCollectionRetryResult> {
  if (lock.current) return { kind: "skipped" };

  lock.current = true;

  try {
    return {
      kind: "accepted",
      response: await startCollection(target),
    };
  } finally {
    lock.current = false;
  }
}

type SummaryCollectionProbeDependencies = {
  getSummaryDetail: (
    target: CompanyAnalysisTarget
  ) => Promise<SummaryDetailApiResponse>;
  getCollectionStatus: (
    target: CompanyAnalysisTarget
  ) => Promise<CollectionStatusResponseApi>;
};

function classifyCollectionStatus(
  response: CollectionStatusResponseApi
): SummaryCollectionProbeResult {
  switch (response.status) {
    case "none":
      return { kind: "needs_collection", message: response.message };
    case "pending":
    case "processing":
      return {
        kind: "pending",
        status: response.status,
        message: response.message,
        collectionUpdatedAt:
          response.collection_updated_at ?? response.updated_at,
      };
    case "completed":
      return { kind: "retry_detail", message: response.message };
    case "failed":
      return { kind: "failed", message: response.message };
    default:
      throw new Error("지원하지 않는 데이터 수집 상태입니다.");
  }
}

export async function probeSummaryCollectionState(
  target: CompanyAnalysisTarget,
  dependencies: SummaryCollectionProbeDependencies
): Promise<SummaryCollectionProbeResult> {
  try {
    const detail = await dependencies.getSummaryDetail(target);

    if (detail.collection_status === "completed") {
      return { kind: "completed", detail };
    }

    return classifyCollectionStatus({
      status: detail.collection_status,
      message: detail.message,
      collection_updated_at: detail.collection_updated_at,
    });
  } catch (error) {
    if (getApiErrorStatus(error) !== 404) {
      throw error;
    }

    const collectionStatus = await dependencies.getCollectionStatus(target);
    return classifyCollectionStatus(collectionStatus);
  }
}

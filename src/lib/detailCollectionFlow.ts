import {
  getApiErrorMessage,
  getFinanceServiceUnavailableKind,
  isCollectionRequiredError,
} from "@/lib/apiErrors";
import {
  COLLECTION_MAX_POLLING_COUNT as DETAIL_COLLECTION_MAX_STATUS_CHECK_COUNT,
  COLLECTION_POLLING_INTERVAL_MS as DETAIL_COLLECTION_POLLING_INTERVAL_MS,
  COLLECTION_PROCESSING_MESSAGE as DETAIL_COLLECTION_PROCESSING_MESSAGE,
  COLLECTION_TIMEOUT_MESSAGE as DETAIL_COLLECTION_TIMEOUT_MESSAGE,
} from "@/lib/collectionPolicy";
import type { CompanyAnalysisTarget } from "@/lib/companySearch";
import type {
  CollectResponseApi,
  SummaryDetailApiResponse,
} from "@/types/api";

const COLLECTION_REQUIRED_DETAIL_MESSAGE = "데이터 수집이 필요합니다.";

export {
  DETAIL_COLLECTION_MAX_STATUS_CHECK_COUNT,
  DETAIL_COLLECTION_POLLING_INTERVAL_MS,
  DETAIL_COLLECTION_PROCESSING_MESSAGE,
  DETAIL_COLLECTION_TIMEOUT_MESSAGE,
};
export const DETAIL_COLLECTION_UNKNOWN_STATUS_MESSAGE =
  "수집 상태를 확인할 수 없습니다. 잠시 후 다시 검색하거나 새로고침해 주세요.";

export type DetailCollectionProbeResult =
  | { kind: "detail"; detail: SummaryDetailApiResponse }
  | { kind: "needs_collection"; message: string };

export type DetailCollectionLifecycleEvent =
  | { kind: "collecting"; message: string }
  | { kind: "polling"; message: string }
  | { kind: "completed"; detail: SummaryDetailApiResponse }
  | { kind: "failed"; message: string }
  | { kind: "timeout"; message: string };

export type DetailCollectionLifecycleResult =
  | { kind: "completed"; detail: SummaryDetailApiResponse }
  | { kind: "failed"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "cancelled" };

export type DetailCollectionRequestLock = {
  promise: Promise<CollectResponseApi> | null;
  response: CollectResponseApi | null;
};

type DetailCollectionLifecycleDependencies = {
  getSummaryDetail: (
    target: CompanyAnalysisTarget
  ) => Promise<SummaryDetailApiResponse>;
  startCollection: (
    target: CompanyAnalysisTarget
  ) => Promise<CollectResponseApi>;
  waitForPollingInterval?: (signal?: AbortSignal) => Promise<void>;
};

type RunDetailCollectionLifecycleOptions = {
  signal?: AbortSignal;
  onEvent?: (event: DetailCollectionLifecycleEvent) => void;
  maxStatusCheckCount?: number;
};

const CANCELLED = Symbol("detail-collection-cancelled");

export function createDetailCollectionRequestLock(): DetailCollectionRequestLock {
  return { promise: null, response: null };
}

export function isDetailCollectionRequiredError(error: unknown) {
  return isCollectionRequiredError(error);
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

function waitForPollingInterval(signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const finish = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timeoutId = setTimeout(
      finish,
      DETAIL_COLLECTION_POLLING_INTERVAL_MS
    );
    signal?.addEventListener("abort", finish, { once: true });
  });
}

async function startCollectionOnce(
  target: CompanyAnalysisTarget,
  startCollection: DetailCollectionLifecycleDependencies["startCollection"],
  lock: DetailCollectionRequestLock
) {
  if (lock.response) return lock.response;
  if (lock.promise) return lock.promise;

  const request = startCollection(target);
  lock.promise = request;

  try {
    const response = await request;
    lock.response = response;
    return response;
  } finally {
    if (lock.promise === request) {
      lock.promise = null;
    }
  }
}

export async function runDetailCollectionLifecycle(
  target: CompanyAnalysisTarget,
  dependencies: DetailCollectionLifecycleDependencies,
  collectionLock: DetailCollectionRequestLock,
  options: RunDetailCollectionLifecycleOptions = {}
): Promise<DetailCollectionLifecycleResult> {
  const signal = options.signal;
  const maxStatusCheckCount =
    options.maxStatusCheckCount ?? DETAIL_COLLECTION_MAX_STATUS_CHECK_COUNT;
  const wait =
    dependencies.waitForPollingInterval ?? waitForPollingInterval;
  let statusCheckCount = 0;

  const isActive = () => !signal?.aborted;
  const emit = (event: DetailCollectionLifecycleEvent) => {
    if (isActive()) options.onEvent?.(event);
  };
  const cancelled = (): DetailCollectionLifecycleResult => ({
    kind: "cancelled",
  });
  const timeout = (message = DETAIL_COLLECTION_TIMEOUT_MESSAGE) => {
    const result = { kind: "timeout" as const, message };
    emit(result);
    return result;
  };
  const failed = (message?: string | null) => {
    const result = {
      kind: "failed" as const,
      message:
        message ??
        "데이터 수집에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
    emit(result);
    return result;
  };
  const completed = (detail: SummaryDetailApiResponse) => {
    const result = { kind: "completed" as const, detail };
    emit(result);
    return result;
  };
  const waitForNextCheck = async () => {
    await wait(signal);
    return isActive();
  };
  const runWithLoadingRetry = async <T>(operation: () => Promise<T>) => {
    while (isActive()) {
      try {
        return await operation();
      } catch (error) {
        if (
          getFinanceServiceUnavailableKind(error) !== "loading" ||
          statusCheckCount >= maxStatusCheckCount
        ) {
          throw error;
        }

        statusCheckCount += 1;
        emit({ kind: "polling", message: getApiErrorMessage(error) });
        if (!(await waitForNextCheck())) return CANCELLED;
      }
    }

    return CANCELLED;
  };

  const initialProbe = await runWithLoadingRetry(() =>
    probeDetailCollectionState(target, dependencies.getSummaryDetail)
  );
  if (initialProbe === CANCELLED || !isActive()) return cancelled();

  if (initialProbe.kind === "detail") {
    const status = initialProbe.detail.collection_status;

    if (status === "completed") return completed(initialProbe.detail);
    if (status === "failed") return failed(initialProbe.detail.message);
    if (status === null) return timeout(DETAIL_COLLECTION_UNKNOWN_STATUS_MESSAGE);

    emit({
      kind: "polling",
      message: DETAIL_COLLECTION_PROCESSING_MESSAGE,
    });
  } else {
    emit({
      kind: "collecting",
      message: "수집 이력이 없어 데이터 수집을 요청하는 중입니다.",
    });

    const collectResponse = await runWithLoadingRetry(() =>
      startCollectionOnce(target, dependencies.startCollection, collectionLock)
    );
    if (collectResponse === CANCELLED || !isActive()) return cancelled();

    emit({
      kind: "polling",
      message:
        collectResponse.message ??
        (collectResponse.status === "already_processing"
          ? "이미 수집이 진행 중입니다. 완료되면 자동으로 다시 불러옵니다."
          : `"${target.keyword}" 분석 상태를 확인 중입니다.`),
    });
  }

  while (isActive()) {
    statusCheckCount += 1;
    const detailProbe = await runWithLoadingRetry(() =>
      probeDetailCollectionState(target, dependencies.getSummaryDetail)
    );
    if (detailProbe === CANCELLED || !isActive()) return cancelled();

    if (detailProbe.kind === "detail") {
      const detailStatus = detailProbe.detail.collection_status;

      if (detailStatus === "completed") return completed(detailProbe.detail);
      if (detailStatus === "failed") return failed(detailProbe.detail.message);
      if (detailStatus === null) {
        return timeout(DETAIL_COLLECTION_UNKNOWN_STATUS_MESSAGE);
      }
    }

    emit({
      kind: "polling",
      message: DETAIL_COLLECTION_PROCESSING_MESSAGE,
    });

    if (statusCheckCount >= maxStatusCheckCount) return timeout();
    if (!(await waitForNextCheck())) return cancelled();
  }

  return cancelled();
}

import assert from "node:assert/strict";
import test from "node:test";
import { getCollectionStatus } from "@/lib/api";
import {
  getInitialSummaryAction,
  isTerminalSummaryPollResult,
  probeSummaryCollectionState,
  retryFailedSummaryCollection,
} from "@/lib/summaryCollectionFlow";
import type { CompanyAnalysisTarget } from "@/lib/companySearch";
import type {
  CollectResponseApi,
  CollectionStatusResponseApi,
  SummaryDetailApiResponse,
} from "@/types/api";

const target: CompanyAnalysisTarget = {
  keyword: "시프트업",
  stockCode: "462870",
  displayName: "시프트업",
};

const completedDetail = {
  collection_status: "completed",
  summary: {},
  trend: {},
} as SummaryDetailApiResponse;

function httpError(status: number, message = `HTTP ${status}`) {
  return Object.assign(new Error(message), { status });
}

function statusResponse(
  status: CollectionStatusResponseApi["status"],
  message?: string
): CollectionStatusResponseApi {
  return { status, message };
}

test("completed detail skips collection status and collection", async () => {
  let statusCalls = 0;
  let collectCalls = 0;

  const result = await probeSummaryCollectionState(target, {
    getSummaryDetail: async () => completedDetail,
    getCollectionStatus: async () => {
      statusCalls += 1;
      return statusResponse("none");
    },
  });

  if (getInitialSummaryAction(result.kind === "completed" ? "completed" : "error") === "collect") {
    collectCalls += 1;
  }

  assert.equal(result.kind, "completed");
  assert.equal(statusCalls, 0);
  assert.equal(collectCalls, 0);
});

test("uncollected detail uses status, collects once, and reaches completed", async () => {
  const statuses: CollectionStatusResponseApi["status"][] = [
    "none",
    "pending",
    "processing",
    "completed",
  ];
  let detailCalls = 0;
  let statusCalls = 0;
  let collectCalls = 0;

  const dependencies = {
    getSummaryDetail: async () => {
      detailCalls += 1;
      if (detailCalls <= statuses.length) throw httpError(404);
      return completedDetail;
    },
    getCollectionStatus: async () => {
      const status = statuses[statusCalls];
      statusCalls += 1;
      assert.ok(status);
      return statusResponse(status);
    },
  };

  const initial = await probeSummaryCollectionState(target, dependencies);
  assert.equal(initial.kind, "needs_collection");

  if (getInitialSummaryAction("needs_collection") === "collect") {
    collectCalls += 1;
  }

  assert.equal((await probeSummaryCollectionState(target, dependencies)).kind, "pending");
  assert.equal((await probeSummaryCollectionState(target, dependencies)).kind, "pending");
  assert.equal((await probeSummaryCollectionState(target, dependencies)).kind, "retry_detail");
  assert.equal((await probeSummaryCollectionState(target, dependencies)).kind, "completed");
  assert.equal(collectCalls, 1);
  assert.equal(statusCalls, 4);
});

for (const status of ["pending", "processing"] as const) {
  test(`${status} continues polling without collecting`, async () => {
    let collectCalls = 0;
    const result = await probeSummaryCollectionState(target, {
      getSummaryDetail: async () => {
        throw httpError(404);
      },
      getCollectionStatus: async () => statusResponse(status),
    });

    if (getInitialSummaryAction(result.kind === "pending" ? "pending" : "error") === "collect") {
      collectCalls += 1;
    }

    assert.equal(result.kind, "pending");
    assert.equal(collectCalls, 0);
  });
}

test("collection status 404 stops without collecting", async () => {
  const collectCalls = 0;

  await assert.rejects(
    probeSummaryCollectionState(target, {
      getSummaryDetail: async () => {
        throw httpError(404);
      },
      getCollectionStatus: async () => {
        throw httpError(404, "기업을 찾을 수 없습니다.");
      },
    }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 404);
      return true;
    }
  );

  assert.equal(collectCalls, 0);
});

test("failed collection status is terminal and does not collect", async () => {
  const result = await probeSummaryCollectionState(target, {
    getSummaryDetail: async () => {
      throw httpError(404);
    },
    getCollectionStatus: async () => statusResponse("failed", "수집에 실패했습니다."),
  });

  assert.deepEqual(result, { kind: "failed", message: "수집에 실패했습니다." });
  assert.equal(getInitialSummaryAction("failed"), "stop");
});

for (const responseStatus of ["started", "already_processing"] as const) {
  test(`manual failed retry accepts ${responseStatus} and calls collection once`, async () => {
    let collectCalls = 0;
    const lock = { current: false };

    const result = await retryFailedSummaryCollection(
      target,
      async () => {
        collectCalls += 1;
        return {
          status: responseStatus,
          resolved_code: "462870",
        };
      },
      lock
    );

    assert.equal(result.kind, "accepted");
    assert.equal(result.kind === "accepted" && result.response.status, responseStatus);
    assert.equal(collectCalls, 1);
    assert.equal(lock.current, false);
  });
}

test("rapid failed retry clicks share a single collection request", async () => {
  let collectCalls = 0;
  let resolveCollection!: (response: CollectResponseApi) => void;
  const lock = { current: false };
  const pendingCollection = new Promise<CollectResponseApi>((resolve) => {
    resolveCollection = resolve;
  });
  const startCollection = async () => {
    collectCalls += 1;
    return pendingCollection;
  };

  const first = retryFailedSummaryCollection(target, startCollection, lock);
  const second = await retryFailedSummaryCollection(target, startCollection, lock);

  assert.deepEqual(second, { kind: "skipped" });
  assert.equal(collectCalls, 1);

  resolveCollection({ status: "started", resolved_code: "462870" });
  assert.equal((await first).kind, "accepted");
  assert.equal(lock.current, false);
});

test("failed retry errors release the click lock without automatic retry", async () => {
  let collectCalls = 0;
  const lock = { current: false };
  const startCollection = async (): Promise<CollectResponseApi> => {
    collectCalls += 1;
    throw httpError(500);
  };

  await assert.rejects(
    retryFailedSummaryCollection(target, startCollection, lock),
    (error: unknown) => (error as { status?: number }).status === 500
  );

  assert.equal(collectCalls, 1);
  assert.equal(lock.current, false);
  assert.equal(getInitialSummaryAction("failed"), "stop");
});

test("a retry that fails again does not trigger another collection automatically", async () => {
  let collectCalls = 0;
  const lock = { current: false };

  await retryFailedSummaryCollection(
    target,
    async () => {
      collectCalls += 1;
      return { status: "started", resolved_code: "462870" };
    },
    lock
  );

  const nextPollResult = "failed" as const;
  assert.equal(getInitialSummaryAction(nextPollResult), "stop");
  assert.equal(collectCalls, 1);
});

test("detail 503 preserves the existing error path", async () => {
  let statusCalls = 0;

  await assert.rejects(
    probeSummaryCollectionState(target, {
      getSummaryDetail: async () => {
        throw httpError(503, "기업 리스트 로딩 중");
      },
      getCollectionStatus: async () => {
        statusCalls += 1;
        return statusResponse("none");
      },
    }),
    (error: unknown) => (error as { status?: number }).status === 503
  );

  assert.equal(statusCalls, 0);
});

for (const status of [401, 403]) {
  test(`detail ${status} does not enter the collection-status fallback`, async () => {
    let statusCalls = 0;

    await assert.rejects(
      probeSummaryCollectionState(target, {
        getSummaryDetail: async () => {
          throw httpError(status);
        },
        getCollectionStatus: async () => {
          statusCalls += 1;
          return statusResponse("none");
        },
      }),
      (error: unknown) => (error as { status?: number }).status === status
    );

    assert.equal(statusCalls, 0);
  });
}

test("completed, errors, failures, and timeout remain distinct terminal results", () => {
  assert.equal(isTerminalSummaryPollResult("completed"), true);
  assert.equal(isTerminalSummaryPollResult("failed"), true);
  assert.equal(isTerminalSummaryPollResult("error"), true);
  assert.equal(isTerminalSummaryPollResult("timeout"), true);
  assert.notEqual("timeout", "completed");
  assert.equal(getInitialSummaryAction("timeout"), "stop");
});

test("collection status API uses the finance status endpoint without an API key", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ status: "none" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await getCollectionStatus(target);
    const headers = requestInit?.headers as Record<string, string>;

    assert.equal(response.status, "none");
    assert.match(requestUrl, /\/api\/v1\/finance\/collect\/status\?/);
    assert.match(requestUrl, /stockCode=462870/);
    assert.equal(requestInit?.method, undefined);
    assert.equal(headers["X-API-Key"], undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

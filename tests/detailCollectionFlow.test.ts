import assert from "node:assert/strict";
import test from "node:test";
import {
  DETAIL_COLLECTION_UNKNOWN_STATUS_MESSAGE,
  createDetailCollectionRequestLock,
  isDetailCollectionRequiredError,
  probeDetailCollectionState,
  runDetailCollectionLifecycle,
  type DetailCollectionLifecycleEvent,
} from "@/lib/detailCollectionFlow";
import type { CompanyAnalysisTarget } from "@/lib/companySearch";
import type { SummaryDetailApiResponse } from "@/types/api";

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

const startedCollection = {
  status: "started" as const,
  resolved_code: "462870",
};

function httpError(status: number, userMessage?: string, code?: string) {
  return Object.assign(new Error(`HTTP ${status}`), {
    code,
    detail: userMessage,
    status,
    userMessage,
  });
}

test("COLLECTION_REQUIRED code is authoritative over a changed detail", async () => {
  const result = await probeDetailCollectionState(target, async () => {
    throw httpError(404, "새로운 백엔드 문구", "COLLECTION_REQUIRED");
  });

  assert.deepEqual(result, {
    kind: "needs_collection",
    message: "데이터 수집이 필요합니다.",
  });
});

test("exact collection-required 404 returns needs_collection", async () => {
  const result = await probeDetailCollectionState(target, async () => {
    throw httpError(404, "데이터 수집이 필요합니다.");
  });

  assert.deepEqual(result, {
    kind: "needs_collection",
    message: "데이터 수집이 필요합니다.",
  });
});

test("a null detail status remains a detail response", async () => {
  const result = await probeDetailCollectionState(target, async () => ({
    ...completedDetail,
    collection_status: null,
  }));

  assert.equal(result.kind, "detail");
  assert.equal(result.kind === "detail" && result.detail.collection_status, null);
});

test("only the exact collection-required 404 is classified for collection", () => {
  assert.equal(
    isDetailCollectionRequiredError(httpError(404, "데이터 수집이 필요합니다.")),
    true
  );
  assert.equal(
    isDetailCollectionRequiredError(
      httpError(404, " 데이터 수집이 필요합니다. ")
    ),
    false
  );
  assert.equal(
    isDetailCollectionRequiredError(httpError(404, "데이터 수집이 필요합니다")),
    false
  );
  assert.equal(
    isDetailCollectionRequiredError(httpError(404, "기업을 찾을 수 없습니다.")),
    false
  );
  assert.equal(isDetailCollectionRequiredError(httpError(404)), false);
});

for (const [status, code] of [
  [404, "COMPANY_NOT_FOUND"],
  [404, "COMPANY_DELISTED"],
  [503, "SERVICE_NOT_READY"],
] as const) {
  test(`${code} stays on the error path without starting collection`, async () => {
    const error = httpError(
      status,
      "데이터 수집이 필요합니다.",
      code
    );
    let collectCalls = 0;

    await assert.rejects(
      runDetailCollectionLifecycle(
        target,
        {
          getSummaryDetail: async () => {
            throw error;
          },
          startCollection: async () => {
            collectCalls += 1;
            return startedCollection;
          },
        },
        createDetailCollectionRequestLock()
      ),
      (actual: unknown) => actual === error
    );

    assert.equal(collectCalls, 0);
  });
}

test("a general 404 preserves the original error", async () => {
  const error = httpError(404, "기업을 찾을 수 없습니다.");

  await assert.rejects(
    probeDetailCollectionState(target, async () => {
      throw error;
    }),
    (actual: unknown) => actual === error
  );
});

for (const status of [401, 403, 429, 503]) {
  test(`${status} preserves the existing error path`, async () => {
    const error = httpError(
      status,
      status === 503 ? "기업 리스트 로딩 중" : undefined
    );

    await assert.rejects(
      probeDetailCollectionState(target, async () => {
        throw error;
      }),
      (actual: unknown) => actual === error
    );
  });
}

test("production lifecycle collects once and polls detail through completed", async () => {
  let detailCalls = 0;
  let collectCalls = 0;
  let waitCalls = 0;
  const events: DetailCollectionLifecycleEvent[] = [];

  const result = await runDetailCollectionLifecycle(
    target,
    {
      getSummaryDetail: async () => {
        detailCalls += 1;
        if (detailCalls === 1) {
          throw httpError(404, "데이터 수집이 필요합니다.");
        }
        if (detailCalls === 2) {
          return { ...completedDetail, collection_status: "pending" };
        }
        if (detailCalls === 3) {
          return { ...completedDetail, collection_status: "processing" };
        }
        return completedDetail;
      },
      startCollection: async () => {
        collectCalls += 1;
        return startedCollection;
      },
      waitForPollingInterval: async () => {
        waitCalls += 1;
      },
    },
    createDetailCollectionRequestLock(),
    { onEvent: (event) => events.push(event) }
  );

  assert.equal(result.kind, "completed");
  assert.equal(
    result.kind === "completed" && result.detail,
    completedDetail
  );
  assert.equal(detailCalls, 4);
  assert.equal(collectCalls, 1);
  assert.equal(waitCalls, 2);
  assert.deepEqual(
    events.map((event) => event.kind),
    ["collecting", "polling", "polling", "polling", "completed"]
  );
});

test("a repeated collection-required detail during polling never collects again", async () => {
  let detailCalls = 0;
  let collectCalls = 0;

  const result = await runDetailCollectionLifecycle(
    target,
    {
      getSummaryDetail: async () => {
        detailCalls += 1;
        if (detailCalls <= 2) {
          throw httpError(404, "데이터 수집이 필요합니다.");
        }
        return {
          ...completedDetail,
          collection_status: "failed",
          message: "수집 실패",
        };
      },
      startCollection: async () => {
        collectCalls += 1;
        return startedCollection;
      },
      waitForPollingInterval: async () => {},
    },
    createDetailCollectionRequestLock()
  );

  assert.deepEqual(result, { kind: "failed", message: "수집 실패" });
  assert.equal(detailCalls, 3);
  assert.equal(collectCalls, 1);
});

test("an initial pending detail polls without starting collection", async () => {
  let detailCalls = 0;
  let collectCalls = 0;

  const result = await runDetailCollectionLifecycle(
    target,
    {
      getSummaryDetail: async () => {
        detailCalls += 1;
        if (detailCalls === 1) {
          return { ...completedDetail, collection_status: "pending" };
        }
        if (detailCalls === 2) {
          return { ...completedDetail, collection_status: "processing" };
        }
        return completedDetail;
      },
      startCollection: async () => {
        collectCalls += 1;
        return startedCollection;
      },
      waitForPollingInterval: async () => {},
    },
    createDetailCollectionRequestLock()
  );

  assert.equal(result.kind, "completed");
  assert.equal(detailCalls, 3);
  assert.equal(collectCalls, 0);
});

test("an initial completed detail is used without another request", async () => {
  let detailCalls = 0;
  let collectCalls = 0;

  const result = await runDetailCollectionLifecycle(
    target,
    {
      getSummaryDetail: async () => {
        detailCalls += 1;
        return completedDetail;
      },
      startCollection: async () => {
        collectCalls += 1;
        return startedCollection;
      },
    },
    createDetailCollectionRequestLock()
  );

  assert.deepEqual(result, { kind: "completed", detail: completedDetail });
  assert.equal(detailCalls, 1);
  assert.equal(collectCalls, 0);
});

test("a null detail status keeps the existing unknown-status terminal result", async () => {
  let collectCalls = 0;

  const result = await runDetailCollectionLifecycle(
    target,
    {
      getSummaryDetail: async () => ({
        ...completedDetail,
        collection_status: null,
      }),
      startCollection: async () => {
        collectCalls += 1;
        return startedCollection;
      },
    },
    createDetailCollectionRequestLock()
  );

  assert.deepEqual(result, {
    kind: "timeout",
    message: DETAIL_COLLECTION_UNKNOWN_STATUS_MESSAGE,
  });
  assert.equal(collectCalls, 0);
});

test("concurrent lifecycle runs share the same collection request lock", async () => {
  let detailCalls = 0;
  let collectCalls = 0;
  let resolveCollection:
    | ((response: typeof startedCollection) => void)
    | undefined;
  const collectionResponse = new Promise<typeof startedCollection>(
    (resolve) => {
      resolveCollection = resolve;
    }
  );
  const lock = createDetailCollectionRequestLock();
  const dependencies = {
    getSummaryDetail: async () => {
      detailCalls += 1;
      if (detailCalls <= 2) {
        throw httpError(404, "데이터 수집이 필요합니다.");
      }
      return {
        ...completedDetail,
        collection_status: "failed" as const,
        message: "수집 실패",
      };
    },
    startCollection: async () => {
      collectCalls += 1;
      return collectionResponse;
    },
    waitForPollingInterval: async () => {},
  };

  const first = runDetailCollectionLifecycle(target, dependencies, lock);
  const second = runDetailCollectionLifecycle(target, dependencies, lock);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(collectCalls, 1);
  resolveCollection?.(startedCollection);

  const results = await Promise.all([first, second]);
  assert.deepEqual(
    results.map((result) => result.kind),
    ["failed", "failed"]
  );
  assert.equal(collectCalls, 1);
});

test("a new target uses a new collection request session", async () => {
  const detailCalls = new Map<string, number>();
  let collectCalls = 0;
  const dependencies = {
    getSummaryDetail: async (requestTarget: CompanyAnalysisTarget) => {
      const calls = (detailCalls.get(requestTarget.keyword) ?? 0) + 1;
      detailCalls.set(requestTarget.keyword, calls);

      if (calls === 1) {
        throw httpError(404, "데이터 수집이 필요합니다.");
      }

      return {
        ...completedDetail,
        collection_status: "failed" as const,
        message: "수집 실패",
      };
    },
    startCollection: async () => {
      collectCalls += 1;
      return startedCollection;
    },
  };
  const nextTarget = {
    ...target,
    keyword: "삼성전자",
    stockCode: "005930",
  };

  await runDetailCollectionLifecycle(
    target,
    dependencies,
    createDetailCollectionRequestLock()
  );
  await runDetailCollectionLifecycle(
    nextTarget,
    dependencies,
    createDetailCollectionRequestLock()
  );

  assert.equal(collectCalls, 2);
  assert.equal(detailCalls.get(target.keyword), 2);
  assert.equal(detailCalls.get(nextTarget.keyword), 2);
});

test("failed detail polling stops without an automatic recollect loop", async () => {
  let detailCalls = 0;
  let collectCalls = 0;

  const result = await runDetailCollectionLifecycle(
    target,
    {
      getSummaryDetail: async () => {
        detailCalls += 1;
        if (detailCalls === 1) {
          throw httpError(404, "데이터 수집이 필요합니다.");
        }
        return {
          ...completedDetail,
          collection_status: "failed",
          message: "백엔드 수집 실패",
        };
      },
      startCollection: async () => {
        collectCalls += 1;
        return startedCollection;
      },
    },
    createDetailCollectionRequestLock()
  );

  assert.deepEqual(result, {
    kind: "failed",
    message: "백엔드 수집 실패",
  });
  assert.equal(detailCalls, 2);
  assert.equal(collectCalls, 1);
});

test("production lifecycle preserves a general detail 404", async () => {
  const error = httpError(404, "기업을 찾을 수 없습니다.");
  let collectCalls = 0;

  await assert.rejects(
    runDetailCollectionLifecycle(
      target,
      {
        getSummaryDetail: async () => {
          throw error;
        },
        startCollection: async () => {
          collectCalls += 1;
          return startedCollection;
        },
      },
      createDetailCollectionRequestLock()
    ),
    (actual: unknown) => actual === error
  );

  assert.equal(collectCalls, 0);
});

test("abort during a polling wait prevents later detail requests", async () => {
  const controller = new AbortController();
  let detailCalls = 0;
  let waitStarted: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    waitStarted = resolve;
  });

  const lifecycle = runDetailCollectionLifecycle(
    target,
    {
      getSummaryDetail: async () => {
        detailCalls += 1;
        return { ...completedDetail, collection_status: "pending" };
      },
      startCollection: async () => {
        throw new Error("collection should not start");
      },
      waitForPollingInterval: async (signal) => {
        waitStarted?.();
        await new Promise<void>((resolve) => {
          signal?.addEventListener("abort", () => resolve(), { once: true });
        });
      },
    },
    createDetailCollectionRequestLock(),
    { signal: controller.signal }
  );

  await waiting;
  controller.abort();

  assert.deepEqual(await lifecycle, { kind: "cancelled" });
  assert.equal(detailCalls, 2);
});

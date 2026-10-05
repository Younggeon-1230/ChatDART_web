import assert from "node:assert/strict";
import test from "node:test";
import {
  isDetailCollectionRequiredError,
  probeDetailCollectionState,
} from "@/lib/detailCollectionFlow";
import type { CompanyAnalysisTarget } from "@/lib/companySearch";
import type {
  CollectResponseApi,
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

function httpError(status: number, userMessage?: string) {
  return Object.assign(new Error(`HTTP ${status}`), { status, userMessage });
}

test("200 none starts collection", async () => {
  let collectCalls = 0;
  const result = await probeDetailCollectionState(target, async () => ({
    ...completedDetail,
    collection_status: "none",
  }));

  assert.equal(result.kind, "detail");

  if (
    result.kind === "detail" &&
    result.detail.collection_status === "none"
  ) {
    collectCalls += 1;
  }

  assert.equal(collectCalls, 1);
});

test("explicit collection-required 404 starts collection once and reaches completed", async () => {
  let detailCalls = 0;
  let collectCalls = 0;

  const getSummaryDetail = async () => {
    detailCalls += 1;
    if (detailCalls === 1) {
      throw httpError(404, "데이터 수집이 필요합니다.");
    }
    return completedDetail;
  };
  const startCollection = async (): Promise<CollectResponseApi> => {
    collectCalls += 1;
    return { status: "started", resolved_code: "462870" };
  };

  const initial = await probeDetailCollectionState(target, getSummaryDetail);
  assert.deepEqual(initial, {
    kind: "needs_collection",
    message: "데이터 수집이 필요합니다.",
  });

  if (initial.kind === "needs_collection") {
    await startCollection();
  }

  const completed = await probeDetailCollectionState(target, getSummaryDetail);
  assert.equal(completed.kind, "detail");
  assert.equal(
    completed.kind === "detail" && completed.detail.collection_status,
    "completed"
  );
  assert.equal(collectCalls, 1);
});

test("only the exact collection-required 404 is classified for collection", () => {
  assert.equal(
    isDetailCollectionRequiredError(
      httpError(404, " 데이터 수집이 필요합니다. ")
    ),
    true
  );
  assert.equal(
    isDetailCollectionRequiredError(httpError(404, "기업을 찾을 수 없습니다.")),
    false
  );
  assert.equal(isDetailCollectionRequiredError(httpError(404)), false);
});

test("a general 404 does not enter the collection flow", async () => {
  const collectCalls = 0;
  const error = httpError(404, "기업을 찾을 수 없습니다.");

  await assert.rejects(
    probeDetailCollectionState(target, async () => {
      throw error;
    }),
    (actual: unknown) => actual === error
  );

  assert.equal(collectCalls, 0);
});

for (const status of [401, 403, 429, 503]) {
  test(`${status} preserves the existing error path`, async () => {
    const collectCalls = 0;
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

    assert.equal(collectCalls, 0);
  });
}

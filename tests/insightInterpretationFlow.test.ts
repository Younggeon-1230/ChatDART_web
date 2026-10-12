import assert from "node:assert/strict";
import test from "node:test";
import { getInsightInterpretationRequestKey } from "@/lib/api";
import type { FinancialInsight } from "@/lib/financialInsights";
import {
  getInsightInterpretationFlowEntry,
  type InsightInterpretationCache,
  type InsightInterpretationFlowInput,
} from "@/lib/insightInterpretationFlow";
import type { InsightInterpretationResponseApi } from "@/types/api";

function makeInsight(
  overrides: Partial<FinancialInsight> = {}
): FinancialInsight {
  return {
    id: "revenue-and-operating-profit-up",
    type: "positive",
    title: "매출과 영업이익 증가",
    description: "fixture",
    year: 2025,
    evidence: [
      {
        label: "매출",
        previousValue: 100,
        currentValue: 120,
        changeRate: 20,
      },
    ],
    ...overrides,
  };
}

function makeFlowInput(
  overrides: Partial<InsightInterpretationFlowInput> = {}
): InsightInterpretationFlowInput {
  return {
    enabled: true,
    isFinancialSector: false,
    stockCode: "005930",
    company: "삼성전자",
    latestYear: 2025,
    insights: [makeInsight()],
    ...overrides,
  };
}

function makeSuccessResponse(): InsightInterpretationResponseApi {
  return {
    stock_code: "005930",
    interpretation_available: true,
    primary_flag: {
      id: "revenue-and-operating-profit-up",
      year: 2025,
    },
    interpretation: {
      headline: "성장 신호가 확인됩니다.",
      positive: "매출이 증가했습니다.",
      caution: null,
      check_items: ["다음 분기 매출을 확인하세요."],
    },
  };
}

function createMemoryStorage(initialValues: Record<string, string>): Storage {
  const values = new Map(Object.entries(initialValues));

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function installAuthenticatedWindow() {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = createMemoryStorage({
    "chatdart.accessToken": "test-access-token",
    "chatdart.tokenType": "bearer",
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      dispatchEvent: () => true,
    },
  });

  return () => {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
      return;
    }

    delete (globalThis as { window?: unknown }).window;
  };
}

test("caches a successful miss and reuses it without another API call", async () => {
  const cache: InsightInterpretationCache = new Map();
  let calls = 0;
  const interpret = async () => {
    calls += 1;
    return makeSuccessResponse();
  };

  const first = getInsightInterpretationFlowEntry(
    makeFlowInput(),
    cache,
    interpret
  );
  assert.ok(first);
  const firstResult = await first.cacheEntry.promise;
  assert.equal(firstResult.status, "success");
  assert.equal(calls, 1);

  const second = getInsightInterpretationFlowEntry(
    makeFlowInput(),
    cache,
    interpret
  );
  assert.ok(second);
  assert.equal(second.cacheEntry, first.cacheEntry);
  assert.equal(second.cacheEntry.result, firstResult);
  assert.equal(calls, 1);
});

test("deduplicates concurrent requests by sharing the in-flight promise", async () => {
  const cache: InsightInterpretationCache = new Map();
  let calls = 0;
  let resolveResponse!: (response: InsightInterpretationResponseApi) => void;
  const pendingResponse = new Promise<InsightInterpretationResponseApi>(
    (resolve) => {
      resolveResponse = resolve;
    }
  );
  const interpret = () => {
    calls += 1;
    return pendingResponse;
  };

  const first = getInsightInterpretationFlowEntry(
    makeFlowInput(),
    cache,
    interpret
  );
  const second = getInsightInterpretationFlowEntry(
    makeFlowInput(),
    cache,
    interpret
  );

  assert.ok(first);
  assert.ok(second);
  assert.equal(calls, 1);
  assert.equal(second.cacheEntry.promise, first.cacheEntry.promise);

  resolveResponse(makeSuccessResponse());
  assert.equal((await first.cacheEntry.promise).status, "success");
  assert.equal(await second.cacheEntry.promise, await first.cacheEntry.promise);
});

test("caches fallback results without an automatic retry", async () => {
  const cache: InsightInterpretationCache = new Map();
  let calls = 0;
  const interpret = async () => {
    calls += 1;
    return {
      stock_code: "005930",
      interpretation_available: false,
      interpretation: null,
      primary_flag: null,
    } satisfies InsightInterpretationResponseApi;
  };

  const first = getInsightInterpretationFlowEntry(
    makeFlowInput(),
    cache,
    interpret
  );
  assert.ok(first);
  assert.equal((await first.cacheEntry.promise).status, "fallback");

  const second = getInsightInterpretationFlowEntry(
    makeFlowInput(),
    cache,
    interpret
  );
  assert.ok(second);
  assert.equal(second.cacheEntry.result?.status, "fallback");
  assert.equal(calls, 1);
});

test("caches errors without an automatic retry", async () => {
  const cache: InsightInterpretationCache = new Map();
  let calls = 0;
  const interpret = async (): Promise<InsightInterpretationResponseApi> => {
    calls += 1;
    throw new Error("interpretation failed");
  };

  const first = getInsightInterpretationFlowEntry(
    makeFlowInput(),
    cache,
    interpret
  );
  assert.ok(first);
  const result = await first.cacheEntry.promise;
  assert.equal(result.status, "error");
  assert.equal(
    result.errorText,
    "AI 해석을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요."
  );

  const second = getInsightInterpretationFlowEntry(
    makeFlowInput(),
    cache,
    interpret
  );
  assert.ok(second);
  assert.equal(second.cacheEntry.result, result);
  assert.equal(calls, 1);
});

test("stops financial-sector interpretation before cache lookup and API execution", () => {
  const cache: InsightInterpretationCache = new Map([
    [
      "unrelated-cache-entry",
      {
        promise: Promise.resolve({
          status: "fallback",
          interpretation: null,
          errorText: "",
        }),
      },
    ],
  ]);
  const getCachedEntry = cache.get.bind(cache);
  let cacheLookups = 0;
  let calls = 0;
  cache.get = (key) => {
    cacheLookups += 1;
    return getCachedEntry(key);
  };
  const flowEntry = getInsightInterpretationFlowEntry(
    makeFlowInput({ isFinancialSector: true }),
    cache,
    async () => {
      calls += 1;
      return makeSuccessResponse();
    }
  );

  assert.equal(flowEntry, null);
  assert.equal(calls, 0);
  assert.equal(cacheLookups, 0);
  assert.equal(cache.size, 1);
});

test("preserves normalized AI response text and item order exactly", async (context) => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();
  let calls = 0;
  const responseInterpretation = {
    headline: "  첫 줄\n둘째 줄  ",
    positive: " 긍정 문장 ",
    caution: "주의\n문장",
    check_items: [" 두 번째가 아닌 첫 항목 ", "두 번째\n항목"],
  };

  context.after(() => {
    globalThis.fetch = originalFetch;
    restoreWindow();
  });

  globalThis.fetch = async (input, init) => {
    calls += 1;
    assert.match(String(input), /\/api\/v1\/finance\/insights\/interpret$/);
    assert.equal(init?.method, "POST");
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer test-access-token"
    );

    return new Response(
      JSON.stringify({
        stock_code: "005930",
        interpretation_available: true,
        primary_flag: {
          id: "revenue-and-operating-profit-up",
          year: 2025,
        },
        interpretation: responseInterpretation,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const flowEntry = getInsightInterpretationFlowEntry(
    makeFlowInput(),
    new Map()
  );
  assert.ok(flowEntry);
  const result = await flowEntry.cacheEntry.promise;

  assert.equal(result.status, "success");
  assert.deepEqual(result.interpretation, responseInterpretation);
  assert.equal("primary_flag" in result, false);
  assert.equal(calls, 1);
});

test("caches an interpretation API 503 as the existing error state", async (context) => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();
  const cache: InsightInterpretationCache = new Map();
  let calls = 0;

  context.after(() => {
    globalThis.fetch = originalFetch;
    restoreWindow();
  });

  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ detail: "service unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  };

  const first = getInsightInterpretationFlowEntry(makeFlowInput(), cache);
  assert.ok(first);
  const result = await first.cacheEntry.promise;
  assert.equal(result.status, "error");
  assert.equal(
    result.errorText,
    "AI 해석을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요."
  );

  const second = getInsightInterpretationFlowEntry(makeFlowInput(), cache);
  assert.ok(second);
  assert.equal(second.cacheEntry.result, result);
  assert.equal(calls, 1);
});

test("keeps the established interpretation request-key boundaries", () => {
  const baseInput = {
    stockCode: "005930",
    company: "삼성전자",
    latestYear: 2025,
    insights: [makeInsight()],
  };
  const baseKey = getInsightInterpretationRequestKey(baseInput);

  assert.ok(baseKey);
  assert.equal(
    getInsightInterpretationRequestKey({ ...baseInput }),
    baseKey
  );
  assert.notEqual(
    getInsightInterpretationRequestKey({
      ...baseInput,
      insights: [
        makeInsight({
          evidence: [
            {
              label: "매출",
              previousValue: 100,
              currentValue: 121,
              changeRate: 21,
            },
          ],
        }),
      ],
    }),
    baseKey
  );
  assert.notEqual(
    getInsightInterpretationRequestKey({ ...baseInput, latestYear: 2024 }),
    baseKey
  );
  assert.notEqual(
    getInsightInterpretationRequestKey({ ...baseInput, stockCode: "000660" }),
    baseKey
  );
  assert.equal(
    getInsightInterpretationRequestKey({
      ...baseInput,
      company: "회사명 변경",
      insights: [makeInsight({ title: "제목 변경", year: 2024 })],
    }),
    baseKey
  );
});

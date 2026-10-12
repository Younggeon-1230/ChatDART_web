import assert from "node:assert/strict";
import test from "node:test";
import {
  getCollectionStatus,
  getSummary,
  getSummaryDetail,
  startCollection,
} from "@/lib/api";
import type { CompanyAnalysisTarget } from "@/lib/companySearch";

const target: CompanyAnalysisTarget = {
  keyword: "테스트 기업",
  stockCode: "123456",
  displayName: "테스트 기업",
};

function installWindowWithAccessToken(accessToken: string) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map([
    ["chatdart.accessToken", accessToken],
    ["chatdart.refreshToken", "refresh-token"],
    ["chatdart.tokenType", "bearer"],
  ]);

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem(key: string) {
          return values.get(key) ?? null;
        },
      },
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

test("startCollection preserves method, target query, and Bearer auth", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installWindowWithAccessToken("access-token");

  globalThis.fetch = async (input, init) => {
    const requestUrl = String(input);
    const headers = init?.headers as Record<string, string>;

    assert.match(requestUrl, /\/api\/v1\/finance\/collect\?/);
    assert.match(requestUrl, /keyword=/);
    assert.match(requestUrl, /corpCode=/);
    assert.match(requestUrl, /stockCode=123456/);
    assert.equal(init?.method, "POST");
    assert.equal(headers.Authorization, "Bearer access-token");
    assert.equal(headers["X-API-Key"], undefined);

    return Response.json({ status: "started", resolved_code: "123456" });
  };

  try {
    const response = await startCollection({
      ...target,
      corpCode: "00123456",
    });
    assert.equal(response.status, "started");
    assert.equal(response.resolved_code, "123456");
    assert.equal(response.__dataSource, "api");
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("getSummary keeps the established response normalization", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    Response.json({
      companyName: "테스트 기업",
      stockCode: "123456",
      fiscalYear: 2024,
      summaryLines: ["첫째 줄", "둘째 줄"],
      history: [
        {
          fiscalYear: 2024,
          revenue: null,
          operatingProfit: "1,000",
        },
      ],
    });

  try {
    const response = await getSummary(target, "억");
    assert.equal(response.company_name, "테스트 기업");
    assert.equal(response.stock_code, "123456");
    assert.equal(response.summary_text, "첫째 줄\n둘째 줄");
    assert.equal(response.history[0]?.revenue, null);
    assert.equal(response.history[0]?.operating_profit, 1000);
    assert.equal(response.__dataSource, "api");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getSummaryDetail preserves every collection_status including null", async () => {
  const originalFetch = globalThis.fetch;
  const statuses = [
    "pending",
    "processing",
    "completed",
    "failed",
    null,
  ] as const;
  let callIndex = 0;

  globalThis.fetch = async (input) => {
    assert.match(String(input), /\/summary\/detail\?/);
    const collectionStatus = statuses[callIndex];
    callIndex += 1;

    return Response.json({
      collection_status: collectionStatus,
      summary: {
        company_name: "테스트 기업",
        stock_code: "123456",
        fiscal_year: 2024,
        summary_text: "요약",
        history: [],
      },
      trend: {},
    });
  };

  try {
    for (const status of statuses) {
      const response = await getSummaryDetail(target);
      assert.equal(response.collection_status, status);
    }
    assert.equal(callIndex, statuses.length);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getSummaryDetail preserves exact and general 404 errors", async () => {
  const originalFetch = globalThis.fetch;
  const messages = [
    "데이터 수집이 필요합니다.",
    "기업을 찾을 수 없습니다.",
  ];
  let callIndex = 0;

  globalThis.fetch = async () => {
    const detail = messages[callIndex];
    callIndex += 1;
    return Response.json({ detail }, { status: 404 });
  };

  try {
    for (const message of messages) {
      await assert.rejects(
        getSummaryDetail(target),
        (error: unknown) => {
          const apiError = error as {
            status?: number;
            userMessage?: string;
          };
          return apiError.status === 404 && apiError.userMessage === message;
        }
      );
    }
    assert.equal(callIndex, messages.length);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("API errors preserve status, detail, and additive backend code", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    Response.json(
      {
        detail: "데이터 수집이 필요합니다.",
        code: "COLLECTION_REQUIRED",
      },
      { status: 404 }
    );

  try {
    await assert.rejects(
      getSummaryDetail(target),
      (error: unknown) => {
        const apiError = error as {
          code?: string;
          detail?: string;
          status?: number;
        };

        assert.equal(apiError.status, 404);
        assert.equal(apiError.detail, "데이터 수집이 필요합니다.");
        assert.equal(apiError.code, "COLLECTION_REQUIRED");
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("collect status and POST keep COMPANY_NOT_FOUND on the error path", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installWindowWithAccessToken("access-token");
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    return Response.json(
      {
        detail: "회사를 찾을 수 없습니다.",
        code: "COMPANY_NOT_FOUND",
      },
      { status: 404 }
    );
  };

  try {
    for (const request of [
      () => getCollectionStatus(target),
      () => startCollection(target),
    ]) {
      await assert.rejects(request, (error: unknown) => {
        const apiError = error as {
          code?: string;
          status?: number;
        };
        return (
          apiError.status === 404 && apiError.code === "COMPANY_NOT_FOUND"
        );
      });
    }

    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("SERVICE_NOT_READY does not fall back to mock summary data", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    Response.json(
      {
        detail: "서비스 준비 중입니다.",
        code: "SERVICE_NOT_READY",
      },
      { status: 503 }
    );

  try {
    await assert.rejects(getSummary(target), (error: unknown) => {
      const apiError = error as {
        code?: string;
        status?: number;
      };
      return apiError.status === 503 && apiError.code === "SERVICE_NOT_READY";
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

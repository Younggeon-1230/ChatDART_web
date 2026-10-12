import assert from "node:assert/strict";
import test from "node:test";

import { searchCompanies } from "@/lib/companySearch";

function createMemoryStorage(initialValues: Record<string, string>): Storage {
  const values = new Map(Object.entries(initialValues));

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function installAuthenticatedWindow() {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = createMemoryStorage({
    "chatdart.accessToken": "search-access-token",
    "chatdart.tokenType": "bearer",
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      dispatchEvent: () => true,
    },
  });

  return () => {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  };
}

test("company search preserves its endpoint, query, and Bearer without tunnel headers", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();
  let requestCount = 0;

  globalThis.fetch = async (input, init) => {
    requestCount += 1;

    const url = new URL(String(input));
    const headers = init?.headers as Record<string, string>;

    assert.equal(url.pathname, "/api/v1/finance/search");
    assert.equal(url.searchParams.get("keyword"), "삼성");
    assert.equal(headers.Authorization, "Bearer search-access-token");
    assert.equal(headers["X-API-Key"], undefined);
    assert.equal(
      Object.keys(headers).some((name) => name.toLowerCase().includes("ngrok")),
      false
    );

    return Response.json({
      query: "삼성",
      results: [{ corp_name: "삼성전자", stock_code: "005930" }],
    });
  };

  try {
    const result = await searchCompanies(" 삼성 ", {
      enableMockFallback: false,
    });

    assert.equal(requestCount, 1);
    assert.equal(result.results[0]?.stockCode, "005930");
    assert.equal(result.dataSource, "api");
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("company search preserves SERVICE_NOT_READY without mock fallback", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();

  globalThis.fetch = async () =>
    Response.json(
      {
        detail: "서비스 준비 중입니다.",
        code: "SERVICE_NOT_READY",
      },
      { status: 503 }
    );

  try {
    await assert.rejects(
      searchCompanies("삼성", { enableMockFallback: true }),
      (error: unknown) => {
        const apiError = error as {
          code?: string;
          detail?: string;
          status?: number;
        };

        return (
          apiError.status === 503 &&
          apiError.code === "SERVICE_NOT_READY" &&
          apiError.detail === "서비스 준비 중입니다."
        );
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompanySearchUrl,
  searchCompanies,
} from "@/lib/companySearch";
import {
  getApiErrorMessage,
} from "@/lib/apiErrors";

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
      location: { origin: "http://chatdart.local" },
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

test("company search URL supports absolute and relative API bases", () => {
  const absoluteUrl = new URL(
    buildCompanySearchUrl(
      "https://api.example.com/api/v1/finance",
      "삼성전자",
      "http://chatdart.local"
    )
  );
  const relativeUrl = new URL(
    buildCompanySearchUrl(
      "/api/v1/finance",
      "삼성전자",
      "http://chatdart.local"
    )
  );

  assert.equal(
    absoluteUrl.toString(),
    "https://api.example.com/api/v1/finance/search?keyword=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90"
  );
  assert.equal(relativeUrl.origin, "http://chatdart.local");
  assert.equal(relativeUrl.pathname, "/api/v1/finance/search");
  assert.equal(relativeUrl.searchParams.get("keyword"), "삼성전자");
  assert.match(relativeUrl.search, /keyword=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90/);
});

test("company search URL remains SSR-safe without a browser origin", () => {
  assert.equal(
    buildCompanySearchUrl("/api/v1/finance", "삼성전자"),
    "/api/v1/finance/search?keyword=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90"
  );
});

test("local URL TypeError is not reported as a network failure", () => {
  const error = new TypeError("Failed to construct 'URL': Invalid URL");

  assert.equal(getApiErrorMessage(error, error.message), error.message);
});

test("actual company search fetch failures keep the network error message", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();

  globalThis.fetch = async () => {
    throw new TypeError("request rejected");
  };

  try {
    await assert.rejects(
      searchCompanies("삼성전자", { enableMockFallback: false }),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "네트워크 연결을 확인한 뒤 다시 시도해 주세요."
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

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

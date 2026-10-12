import assert from "node:assert/strict";
import test from "node:test";
import {
  getPopularCompanies,
  getRecommendedCompanies,
  getSimilarCompanies,
} from "@/lib/api";

function installAuthenticatedWindow() {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem(key: string) {
          if (key === "chatdart.accessToken") return "test-access-token";
          if (key === "chatdart.tokenType") return "bearer";
          return null;
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

test("similar companies preserve endpoint, Bearer auth, and response normalization", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();
  const responseBodies = [
    [{ stock_code: "000001" }],
    { items: [{ stock_code: "000002" }] },
    { similar_companies: [{ stock_code: "000003" }] },
    { results: [{ stock_code: "000004" }] },
  ];
  let callIndex = 0;

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = init?.headers as Record<string, string>;

    assert.equal(url.pathname, "/api/v1/finance/similar");
    assert.equal(url.searchParams.get("keyword"), "삼성전자");
    assert.equal(url.searchParams.get("limit"), "4");
    assert.equal(headers.Authorization, "Bearer test-access-token");
    assert.equal(headers["X-API-Key"], undefined);

    return Response.json(responseBodies[callIndex++]);
  };

  try {
    for (const stockCode of ["000001", "000002", "000003", "000004"]) {
      const companies = await getSimilarCompanies(" 삼성전자 ", 4);
      assert.equal(companies[0]?.stock_code, stockCode);
    }
    assert.equal(callIndex, 4);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("recommendation and popular discovery requests preserve query and Bearer auth", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();
  let callIndex = 0;

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = init?.headers as Record<string, string>;

    assert.equal(headers.Authorization, "Bearer test-access-token");
    assert.equal(headers["X-API-Key"], undefined);

    if (callIndex++ === 0) {
      assert.equal(url.pathname, "/api/v1/finance/recommendation");
      assert.equal(url.searchParams.get("limit"), "3");
      return Response.json([{ stock_code: "005930" }]);
    }

    assert.equal(url.pathname, "/api/v1/finance/search/popular");
    assert.equal(url.searchParams.get("limit"), "7");
    assert.equal(url.searchParams.get("window"), "weekly");
    return Response.json({ items: [], window: "weekly" });
  };

  try {
    const recommended = await getRecommendedCompanies(3);
    const popular = await getPopularCompanies({ limit: 7, window: "weekly" });
    assert.equal(recommended[0]?.stock_code, "005930");
    assert.equal(popular.window, "weekly");
    assert.equal(callIndex, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("similar and recommendation 401/403 responses do not fall back to mock data", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();
  const statuses = [401, 403];
  let callIndex = 0;

  globalThis.fetch = async () => {
    const status = statuses[callIndex++];
    return Response.json({ detail: "not authorized" }, { status });
  };

  try {
    await assert.rejects(
      getSimilarCompanies("삼성전자"),
      (error: unknown) => (error as { status?: number }).status === 401
    );
    await assert.rejects(
      getRecommendedCompanies(),
      (error: unknown) => (error as { status?: number }).status === 403
    );
    assert.equal(callIndex, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

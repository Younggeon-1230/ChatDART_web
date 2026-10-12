import assert from "node:assert/strict";
import test from "node:test";
import {
  getFinancialDisclosures,
  interpretFinancialInsights,
} from "@/lib/api";
import type { FinancialInsight } from "@/lib/financialInsights";
import type { FinancialDisclosuresResponseApi } from "@/types/api";

function insight(id: string, type: FinancialInsight["type"]): FinancialInsight {
  return {
    id,
    type,
    title: id,
    description: id,
    year: 2025,
    evidence: [],
  };
}

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

test("disclosures API preserves warning selection, query, Bearer, and response", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();
  const apiResponse: FinancialDisclosuresResponseApi = {
    stock_code: "005930",
    disclosures: [
      {
        title: "사업보고서",
        date: "2026-03-20",
        submitter: "삼성전자",
        viewer_url: "https://dart.example/report/1",
        category: "periodic",
      },
    ],
  };

  globalThis.fetch = async (input, init) => {
    const requestUrl = new URL(String(input));
    const headers = init?.headers as Record<string, string>;

    assert.equal(requestUrl.pathname, "/api/v1/finance/disclosures");
    assert.equal(requestUrl.searchParams.get("stock_code"), "005930");
    assert.equal(requestUrl.searchParams.get("rule_id"), "warning-rule");
    assert.equal(init?.method, undefined);
    assert.equal(headers.Authorization, "Bearer test-access-token");
    assert.equal(headers["X-API-Key"], undefined);

    return Response.json(apiResponse);
  };

  try {
    const response = await getFinancialDisclosures({
      stockCode: " 005930 ",
      insights: [
        insight("positive-rule", "positive"),
        insight("warning-rule", "warning"),
      ],
    });
    assert.deepEqual(response, apiResponse);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("interpretation API parses the backend-selected primary flag without changing content", async (context) => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();
  const interpretation = {
    headline: "  원문 headline  ",
    positive: "긍정\n원문",
    caution: " 주의 원문 ",
    check_items: ["두 번째가 아닌 첫 항목", "두 번째 항목"],
  };

  context.after(() => {
    globalThis.fetch = originalFetch;
    restoreWindow();
  });

  globalThis.fetch = async () =>
    Response.json({
      stock_code: "005930",
      interpretation,
      interpretation_available: true,
      primary_flag: {
        id: "revenue-up-operating-profit-down",
        year: 2025,
      },
    });

  const response = await interpretFinancialInsights({
    stockCode: "005930",
    company: "삼성전자",
    latestYear: 2025,
    insights: [insight("revenue-up-operating-profit-down", "warning")],
  });

  assert.deepEqual(response, {
    stock_code: "005930",
    interpretation,
    interpretation_available: true,
    primary_flag: {
      id: "revenue-up-operating-profit-down",
      year: 2025,
    },
  });
});

test("interpretation API preserves the existing fallback and null primary flag", async (context) => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();

  context.after(() => {
    globalThis.fetch = originalFetch;
    restoreWindow();
  });

  globalThis.fetch = async () =>
    Response.json({
      stock_code: "005930",
      interpretation: null,
      interpretation_available: false,
      primary_flag: null,
    });

  const response = await interpretFinancialInsights({
    stockCode: "005930",
    company: "삼성전자",
    latestYear: 2025,
    insights: [insight("revenue-up-operating-profit-down", "warning")],
  });

  assert.deepEqual(response, {
    stock_code: "005930",
    interpretation: null,
    interpretation_available: false,
    primary_flag: null,
  });
});

test("interpretation API safely maps a malformed primary flag to null", async (context) => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();

  context.after(() => {
    globalThis.fetch = originalFetch;
    restoreWindow();
  });

  globalThis.fetch = async () =>
    Response.json({
      stock_code: "005930",
      interpretation: {
        headline: "headline",
        positive: null,
        caution: null,
        check_items: [],
      },
      interpretation_available: true,
      primary_flag: {
        id: "revenue-up-operating-profit-down",
        year: "2025",
      },
    });

  const response = await interpretFinancialInsights({
    stockCode: "005930",
    company: "삼성전자",
    latestYear: 2025,
    insights: [insight("revenue-up-operating-profit-down", "warning")],
  });

  assert.equal(response?.primary_flag, null);
  assert.equal(response?.interpretation_available, true);
});

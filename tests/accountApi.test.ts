import assert from "node:assert/strict";
import test from "node:test";
import {
  addWatchlistItem,
  getDashboard,
  getMembershipPlans,
  getMyMembership,
  getWatchlistSummaries,
  removeWatchlistItem,
  updateWatchlistMemo,
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

test("membership plans remain public and normalize the items envelope", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();

  globalThis.fetch = async (input, init) => {
    const headers = init?.headers as Record<string, string>;
    assert.match(String(input), /\/api\/v1\/membership\/plans$/);
    assert.equal(init?.method, undefined);
    assert.equal(headers.Authorization, undefined);
    assert.equal(headers["X-API-Key"], undefined);

    return Response.json({
      items: [
        { plan: "free", watchlist_limit: 5 },
        { plan: "pro", watchlist_limit: 50 },
      ],
    });
  };

  try {
    const plans = await getMembershipPlans();
    assert.deepEqual(
      plans.map((plan) => plan.plan),
      ["free", "pro"]
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("membership me preserves Bearer and response values", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();

  globalThis.fetch = async (input, init) => {
    const headers = init?.headers as Record<string, string>;
    assert.match(String(input), /\/api\/v1\/membership\/me$/);
    assert.equal(headers.Authorization, "Bearer test-access-token");
    assert.equal(headers["X-API-Key"], undefined);

    return Response.json({
      membership_tier: "pro",
      watchlist_limit: null,
      watchlist_count: null,
    });
  };

  try {
    const membership = await getMyMembership();
    assert.equal(membership.membership_tier, "pro");
    assert.equal(membership.watchlist_limit, null);
    assert.equal(membership.watchlist_count, null);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("watchlist endpoints preserve methods, paths, memo normalization, and Bearer", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();
  const calls: Array<{
    path: string;
    method: string | undefined;
    body: unknown;
  }> = [];

  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    const headers = init?.headers as Record<string, string>;
    calls.push({
      path,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    assert.equal(headers.Authorization, "Bearer test-access-token");
    assert.equal(headers["X-API-Key"], undefined);

    if (init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }

    if (path.endsWith("/summaries")) {
      return Response.json([
        { stock_code: "005930", company_name: "삼성전자", memo: null },
      ]);
    }

    if (init?.method === "POST") {
      return Response.json({
        item: { stock_code: "005930", company_name: "삼성전자", memo: null },
      });
    }

    return Response.json({
      stock_code: "005930",
      company_name: "삼성전자",
      memo: "메모",
    });
  };

  try {
    const summaries = await getWatchlistSummaries();
    await addWatchlistItem("005930", "삼성전자", "   ");
    await updateWatchlistMemo("005930", "  메모  ");
    await updateWatchlistMemo("005930", "   ");
    await removeWatchlistItem("005930");

    assert.equal(summaries.items[0]?.memo, null);
    assert.deepEqual(calls, [
      {
        path: "/api/v1/users/me/watchlist/summaries",
        method: undefined,
        body: undefined,
      },
      {
        path: "/api/v1/users/me/watchlist",
        method: "POST",
        body: {
          stock_code: "005930",
          company_name: "삼성전자",
          memo: null,
        },
      },
      {
        path: "/api/v1/users/me/watchlist/005930",
        method: "PATCH",
        body: { memo: "메모" },
      },
      {
        path: "/api/v1/users/me/watchlist/005930",
        method: "PATCH",
        body: { memo: null },
      },
      {
        path: "/api/v1/users/me/watchlist/005930",
        method: "DELETE",
        body: undefined,
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("memo over 500 characters fails before a network request", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({});
  };

  try {
    await assert.rejects(
      updateWatchlistMemo("005930", `  ${"가".repeat(501)}  `),
      (error: unknown) => {
        const memoError = error as { status?: number; message?: string };
        return (
          memoError.status === 422 &&
          memoError.message === "메모는 500자 이내로 입력해 주세요."
        );
      }
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("watchlist 403 and 409 errors remain on the error path", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();
  const statuses = [403, 409];
  let callIndex = 0;

  globalThis.fetch = async () => {
    const status = statuses[callIndex];
    callIndex += 1;
    return Response.json({ detail: `status ${status}` }, { status });
  };

  try {
    await assert.rejects(
      addWatchlistItem("005930", "삼성전자"),
      (error: unknown) => (error as { status?: number }).status === 403
    );
    await assert.rejects(
      addWatchlistItem("005930", "삼성전자"),
      (error: unknown) => (error as { status?: number }).status === 409
    );
    assert.equal(callIndex, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("dashboard preserves endpoint, Bearer, and response shape", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();
  const dashboardResponse = {
    membership_tier: "free",
    watchlist_count: 1,
    watchlist_limit: 5,
    recent_searches: [
      { stock_code: "005930", company_name: "삼성전자" },
      { stock_code: "005930", company_name: "삼성전자" },
    ],
  };

  globalThis.fetch = async (input, init) => {
    const headers = init?.headers as Record<string, string>;
    assert.match(String(input), /\/api\/v1\/users\/me\/dashboard$/);
    assert.equal(headers.Authorization, "Bearer test-access-token");
    assert.equal(headers["X-API-Key"], undefined);
    return Response.json(dashboardResponse);
  };

  try {
    const response = await getDashboard();
    assert.deepEqual(response, dashboardResponse);
    assert.equal(response.recent_searches?.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  getCompareShare,
  getMyMembership,
  login,
  logout,
  logoutCurrentUser,
  refreshToken,
  register,
} from "@/lib/api";
import { request } from "@/lib/api/client";

function createMemoryStorage(initialValues: Record<string, string> = {}): Storage {
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

function installWindowWithStorage(storage: Storage) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

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

function installTimeoutTracker() {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const activeTimers = new Set<ReturnType<typeof setTimeout>>();

  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number) => {
    const timer = { handler, timeout } as unknown as ReturnType<
      typeof setTimeout
    >;
    activeTimers.add(timer);
    return timer;
  }) as unknown as typeof setTimeout;

  globalThis.clearTimeout = ((timer: ReturnType<typeof setTimeout>) => {
    if (!activeTimers.delete(timer)) {
      originalClearTimeout(timer);
    }
  }) as typeof clearTimeout;

  return {
    activeTimers,
    restore() {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    },
  };
}

test("refresh retry gets a new timeout budget and succeeds with the new Bearer token", async () => {
  const originalFetch = globalThis.fetch;
  const storage = createMemoryStorage({
    "chatdart.accessToken": "old-access-token",
    "chatdart.refreshToken": "refresh-token",
    "chatdart.tokenType": "bearer",
  });
  const restoreWindow = installWindowWithStorage(storage);
  const timeoutTracker = installTimeoutTracker();
  let membershipCalls = 0;
  let refreshCalls = 0;
  const membershipSignals: AbortSignal[] = [];

  globalThis.fetch = async (input, init) => {
    const requestUrl = String(input);
    const headers = init?.headers as Record<string, string>;

    assert.equal(headers["X-API-Key"], undefined);
    assert.equal(
      Object.keys(headers).some((name) => name.toLowerCase().includes("ngrok")),
      false
    );
    assert.equal(timeoutTracker.activeTimers.size, 1);

    if (requestUrl.endsWith("/auth/refresh")) {
      refreshCalls += 1;
      assert.equal(headers.Authorization, undefined);
      return new Response(
        JSON.stringify({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          token_type: "bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    assert.match(requestUrl, /\/api\/v1\/membership\/me$/);
    membershipCalls += 1;
    assert.ok(init?.signal);
    membershipSignals.push(init.signal);
    assert.equal(
      headers.Authorization,
      membershipCalls === 1
        ? "Bearer old-access-token"
        : "Bearer new-access-token"
    );

    if (membershipCalls === 1) {
      return new Response(JSON.stringify({ detail: "인증이 필요합니다." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        membership_tier: "free",
        watchlist_limit: 5,
        watchlist_count: 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const response = await getMyMembership();
    assert.equal(response.membership_tier, "free");
    assert.equal(membershipCalls, 2);
    assert.equal(refreshCalls, 1);
    assert.notEqual(membershipSignals[0], membershipSignals[1]);
    assert.equal(timeoutTracker.activeTimers.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
    timeoutTracker.restore();
    restoreWindow();
  }
});

test("a second 401 does not refresh or retry again", async () => {
  const originalFetch = globalThis.fetch;
  const storage = createMemoryStorage({
    "chatdart.accessToken": "old-access-token",
    "chatdart.refreshToken": "refresh-token",
    "chatdart.tokenType": "bearer",
  });
  const restoreWindow = installWindowWithStorage(storage);
  let membershipCalls = 0;
  let refreshCalls = 0;

  globalThis.fetch = async (input, init) => {
    const requestUrl = String(input);
    const headers = init?.headers as Record<string, string>;

    assert.equal(headers["X-API-Key"], undefined);

    if (requestUrl.endsWith("/auth/refresh")) {
      refreshCalls += 1;
      return new Response(
        JSON.stringify({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          token_type: "bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    membershipCalls += 1;
    assert.equal(
      headers.Authorization,
      membershipCalls === 1
        ? "Bearer old-access-token"
        : "Bearer new-access-token"
    );

    return new Response(JSON.stringify({ detail: "인증이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await assert.rejects(
      getMyMembership(),
      (error: unknown) => (error as { status?: number }).status === 401
    );
    assert.equal(membershipCalls, 2);
    assert.equal(refreshCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("public compare share remains callable without auth headers", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installWindowWithStorage(createMemoryStorage());

  globalThis.fetch = async (input, init) => {
    const headers = init?.headers as Record<string, string>;

    assert.match(String(input), /\/api\/v1\/finance\/compare\/public-share$/);
    assert.equal(headers.Authorization, undefined);
    assert.equal(headers["X-API-Key"], undefined);
    assert.equal(
      Object.keys(headers).some((name) => name.toLowerCase().includes("ngrok")),
      false
    );

    return new Response(JSON.stringify({ share_id: "public-share" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await getCompareShare("public-share");
    assert.equal(response.share_id, "public-share");
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("required request without tokens does not add auth or attempt refresh", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installWindowWithStorage(createMemoryStorage());
  let requestCalls = 0;

  globalThis.fetch = async (input, init) => {
    requestCalls += 1;
    assert.match(String(input), /\/api\/v1\/membership\/me$/);
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, undefined);
    assert.equal(headers["X-API-Key"], undefined);

    return new Response(JSON.stringify({ detail: "인증이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await assert.rejects(
      getMyMembership(),
      (error: unknown) => (error as { status?: number }).status === 401
    );
    assert.equal(requestCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("concurrent 401 responses share one refresh request", async () => {
  const originalFetch = globalThis.fetch;
  const storage = createMemoryStorage({
    "chatdart.accessToken": "old-access-token",
    "chatdart.refreshToken": "refresh-token",
    "chatdart.tokenType": "bearer",
  });
  const restoreWindow = installWindowWithStorage(storage);
  let protectedCalls = 0;
  let refreshCalls = 0;
  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });

  globalThis.fetch = async (input, init) => {
    const requestUrl = String(input);
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers["X-API-Key"], undefined);

    if (requestUrl.endsWith("/auth/refresh")) {
      refreshCalls += 1;
      await refreshGate;
      return new Response(
        JSON.stringify({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          token_type: "bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    protectedCalls += 1;
    if (headers.Authorization === "Bearer old-access-token") {
      return new Response(JSON.stringify({ detail: "expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    assert.equal(headers.Authorization, "Bearer new-access-token");
    return new Response(
      JSON.stringify({
        membership_tier: "free",
        watchlist_limit: 5,
        watchlist_count: 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const requests = Promise.all([getMyMembership(), getMyMembership()]);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(refreshCalls, 1);
    releaseRefresh();
    const responses = await requests;
    assert.equal(responses.length, 2);
    assert.equal(protectedCalls, 4);
    assert.equal(refreshCalls, 1);
  } finally {
    releaseRefresh();
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("auth facade preserves endpoint methods, payloads, and auth modes", async () => {
  const originalFetch = globalThis.fetch;
  const storage = createMemoryStorage({
    "chatdart.accessToken": "access-token",
    "chatdart.refreshToken": "stored-refresh-token",
    "chatdart.tokenType": "bearer",
  });
  const restoreWindow = installWindowWithStorage(storage);
  const calls: Array<{
    path: string;
    method: string | undefined;
    body: unknown;
    authorization: string | undefined;
  }> = [];

  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    const headers = init?.headers as Record<string, string>;
    calls.push({
      path,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      authorization: headers.Authorization,
    });
    assert.equal(headers["X-API-Key"], undefined);

    if (path.endsWith("/auth/logout")) {
      return new Response(null, { status: 204 });
    }

    if (path.endsWith("/auth/register")) {
      return Response.json({ user_id: 1, email: "user@example.com" });
    }

    return Response.json({
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      token_type: "bearer",
    });
  };

  try {
    await login({ email: "user@example.com", password: "password" });
    await register({
      email: "user@example.com",
      password: "password",
      nickname: "User",
      terms_agreed: true,
    });
    await refreshToken("explicit-refresh-token");
    await logout("explicit-refresh-token");

    assert.deepEqual(
      calls.map(({ path, method, authorization }) => ({
        path,
        method,
        authorization,
      })),
      [
        {
          path: "/api/v1/auth/login",
          method: "POST",
          authorization: undefined,
        },
        {
          path: "/api/v1/auth/register",
          method: "POST",
          authorization: undefined,
        },
        {
          path: "/api/v1/auth/refresh",
          method: "POST",
          authorization: undefined,
        },
        {
          path: "/api/v1/auth/logout",
          method: "POST",
          authorization: "Bearer access-token",
        },
      ]
    );
    assert.deepEqual(calls[0]?.body, {
      email: "user@example.com",
      password: "password",
    });
    assert.deepEqual(calls[1]?.body, {
      email: "user@example.com",
      password: "password",
      nickname: "User",
      terms_agreed: true,
    });
    assert.deepEqual(calls[2]?.body, {
      refresh_token: "explicit-refresh-token",
    });
    assert.deepEqual(calls[3]?.body, {
      refresh_token: "explicit-refresh-token",
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("logoutCurrentUser clears stored tokens even when logout fails", async () => {
  const originalFetch = globalThis.fetch;
  const storage = createMemoryStorage({
    "chatdart.accessToken": "access-token",
    "chatdart.refreshToken": "refresh-token",
    "chatdart.tokenType": "bearer",
  });
  const restoreWindow = installWindowWithStorage(storage);
  let logoutCalls = 0;

  globalThis.fetch = async (input, init) => {
    logoutCalls += 1;
    assert.match(String(input), /\/api\/v1\/auth\/logout$/);
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer access-token");
    return Response.json({ detail: "failure" }, { status: 500 });
  };

  try {
    await assert.rejects(logoutCurrentUser());
    assert.equal(logoutCalls, 1);
    assert.equal(storage.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

test("optional auth sends Bearer only when an access token exists", async () => {
  const originalFetch = globalThis.fetch;
  const storage = createMemoryStorage({
    "chatdart.accessToken": "optional-access-token",
    "chatdart.refreshToken": "refresh-token",
    "chatdart.tokenType": "bearer",
  });
  const restoreWindow = installWindowWithStorage(storage);
  const authorizationHeaders: Array<string | undefined> = [];

  globalThis.fetch = async (_input, init) => {
    const headers = init?.headers as Record<string, string>;
    authorizationHeaders.push(headers.Authorization);
    assert.equal(headers["X-API-Key"], undefined);
    return Response.json({ ok: true });
  };

  try {
    await request<{ ok: boolean }>("/optional");
    storage.clear();
    await request<{ ok: boolean }>("/optional");
    assert.deepEqual(authorizationHeaders, [
      "Bearer optional-access-token",
      undefined,
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

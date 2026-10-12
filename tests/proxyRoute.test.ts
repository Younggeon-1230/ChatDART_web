import assert from "node:assert/strict";
import test from "node:test";

import {
  DELETE,
  GET,
  HEAD,
  OPTIONS,
  PATCH,
  POST,
  PUT,
} from "@/app/api/[...path]/route";

const CONFIGURATION_ERROR = {
  detail: "Upstream API is not configured.",
};

type ProxyHandler = typeof GET;

function routeContext(...path: string[]) {
  return { params: Promise.resolve({ path }) };
}

async function withUpstreamOrigin(
  value: string | undefined,
  callback: () => Promise<void>,
) {
  const originalValue = process.env.UPSTREAM_API_ORIGIN;

  if (value === undefined) {
    delete process.env.UPSTREAM_API_ORIGIN;
  } else {
    process.env.UPSTREAM_API_ORIGIN = value;
  }

  try {
    await callback();
  } finally {
    if (originalValue === undefined) {
      delete process.env.UPSTREAM_API_ORIGIN;
    } else {
      process.env.UPSTREAM_API_ORIGIN = originalValue;
    }
  }
}

async function withMockFetch(
  mockFetch: typeof globalThis.fetch,
  callback: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function assertRejectedWithoutFetch(value: string | undefined) {
  let fetchCalls = 0;

  await withMockFetch(
    async () => {
      fetchCalls += 1;
      throw new Error("Upstream fetch must not run for invalid configuration.");
    },
    async () => {
      await withUpstreamOrigin(value, async () => {
        const response = await GET(
          new Request("https://frontend.example/api/v1/finance/summary"),
          routeContext("v1", "finance", "summary"),
        );

        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), CONFIGURATION_ERROR);
        assert.equal(fetchCalls, 0);
      });
    },
  );
}

async function callHandler(
  handler: ProxyHandler,
  method: string,
  path: string[],
) {
  return handler(
    new Request(`https://frontend.example/api/${path.join("/")}`, { method }),
    routeContext(...path),
  );
}

test("proxy fails closed when the upstream origin is missing", async () => {
  await assertRejectedWithoutFetch(undefined);
});

test("proxy fails closed for invalid, non-HTTPS, and credential URLs", async (t) => {
  const rejectedOrigins = [
    "not a URL",
    "http://example.com",
    "ftp://example.com",
    "javascript:alert(1)",
    "https://user:password@example.com",
  ];

  for (const origin of rejectedOrigins) {
    await t.test(origin, async () => {
      await assertRejectedWithoutFetch(origin);
    });
  }
});

test("proxy allows every production caller path with its exact method", async () => {
  const allowedRequests: Array<{
    handler: ProxyHandler;
    method: string;
    path: string[];
  }> = [
    { handler: POST, method: "POST", path: ["v1", "auth", "login"] },
    { handler: POST, method: "POST", path: ["v1", "auth", "register"] },
    { handler: POST, method: "POST", path: ["v1", "auth", "refresh"] },
    { handler: POST, method: "POST", path: ["v1", "auth", "logout"] },
    { handler: GET, method: "GET", path: ["v1", "membership", "plans"] },
    { handler: GET, method: "GET", path: ["v1", "membership", "me"] },
    {
      handler: GET,
      method: "GET",
      path: ["v1", "users", "me", "watchlist", "summaries"],
    },
    {
      handler: POST,
      method: "POST",
      path: ["v1", "users", "me", "watchlist"],
    },
    {
      handler: PATCH,
      method: "PATCH",
      path: ["v1", "users", "me", "watchlist", "005930"],
    },
    {
      handler: DELETE,
      method: "DELETE",
      path: ["v1", "users", "me", "watchlist", "005930"],
    },
    {
      handler: GET,
      method: "GET",
      path: ["v1", "users", "me", "dashboard"],
    },
    { handler: POST, method: "POST", path: ["v1", "finance", "collect"] },
    {
      handler: GET,
      method: "GET",
      path: ["v1", "finance", "collect", "status"],
    },
    { handler: GET, method: "GET", path: ["v1", "finance", "summary"] },
    {
      handler: GET,
      method: "GET",
      path: ["v1", "finance", "summary", "detail"],
    },
    {
      handler: GET,
      method: "GET",
      path: ["v1", "finance", "summary", "ai-analysis"],
    },
    {
      handler: POST,
      method: "POST",
      path: ["v1", "finance", "insights", "interpret"],
    },
    {
      handler: GET,
      method: "GET",
      path: ["v1", "finance", "disclosures"],
    },
    {
      handler: POST,
      method: "POST",
      path: ["v1", "finance", "compare", "save"],
    },
    {
      handler: GET,
      method: "GET",
      path: ["v1", "finance", "compare", "abcdef12"],
    },
    { handler: GET, method: "GET", path: ["v1", "finance", "similar"] },
    {
      handler: GET,
      method: "GET",
      path: ["v1", "finance", "recommendation"],
    },
    { handler: GET, method: "GET", path: ["v1", "finance", "search"] },
  ];
  const forwardedRequests: string[] = [];

  await withMockFetch(
    async (input) => {
      forwardedRequests.push(String(input));
      return Response.json({ ok: true });
    },
    async () => {
      await withUpstreamOrigin("https://upstream.example", async () => {
        for (const request of allowedRequests) {
          const response = await callHandler(
            request.handler,
            request.method,
            request.path,
          );
          assert.equal(response.status, 200, request.path.join("/"));
        }
      });
    },
  );

  assert.equal(forwardedRequests.length, allowedRequests.length);
});

test("proxy blocks unknown paths, prefix collisions, and unused public exports", async () => {
  const blockedPaths = [
    ["v1", "finance", "admin"],
    ["v1", "finance", "summary-extra"],
    ["v1", "finance", "summary", "detail-extra"],
    ["v1", "finance", "search", "popular"],
    ["v1", "finance", "compare", "abcdef12", "extra"],
    ["v1", "users", "me", "watchlist", "005930-extra"],
  ];
  let fetchCalls = 0;

  await withMockFetch(
    async () => {
      fetchCalls += 1;
      return Response.json({ ok: true });
    },
    async () => {
      await withUpstreamOrigin("https://upstream.example", async () => {
        for (const path of blockedPaths) {
          const response = await callHandler(GET, "GET", path);
          assert.equal(response.status, 404, path.join("/"));
        }
      });
    },
  );

  assert.equal(fetchCalls, 0);
});

test("proxy rejects method mismatches before fetching", async () => {
  const mismatches: Array<{
    handler: ProxyHandler;
    method: string;
    path: string[];
  }> = [
    { handler: GET, method: "GET", path: ["v1", "auth", "login"] },
    { handler: POST, method: "POST", path: ["v1", "finance", "summary"] },
    { handler: PUT, method: "PUT", path: ["v1", "users", "me", "watchlist", "005930"] },
    { handler: OPTIONS, method: "OPTIONS", path: ["v1", "finance", "search"] },
    { handler: HEAD, method: "HEAD", path: ["_health"] },
  ];
  let fetchCalls = 0;

  await withMockFetch(
    async () => {
      fetchCalls += 1;
      return Response.json({ ok: true });
    },
    async () => {
      await withUpstreamOrigin("https://upstream.example", async () => {
        for (const request of mismatches) {
          const response = await callHandler(
            request.handler,
            request.method,
            request.path,
          );
          assert.equal(response.status, 405, request.path.join("/"));
        }
      });
    },
  );

  assert.equal(fetchCalls, 0);
});

test("proxy rejects traversal and encoded separator bypasses", async () => {
  const unsafePaths = [
    ["v1", "finance", "..", "summary"],
    ["v1", "finance", ".", "summary"],
    ["v1", "finance", "%2e%2e", "summary"],
    ["v1", "finance", "%252e%252e", "summary"],
    ["v1", "finance", "summary%2fdetail"],
    ["v1", "finance", "summary\\detail"],
  ];
  let fetchCalls = 0;

  await withMockFetch(
    async () => {
      fetchCalls += 1;
      return Response.json({ ok: true });
    },
    async () => {
      await withUpstreamOrigin("https://upstream.example", async () => {
        for (const path of unsafePaths) {
          const response = await callHandler(GET, "GET", path);
          assert.equal(response.status, 404, path.join("/"));
        }
      });
    },
  );

  assert.equal(fetchCalls, 0);
});

test("proxy forwards query, body, status, Authorization, and safe headers", async () => {
  let fetchCalls = 0;

  await withMockFetch(
    async (input, init) => {
      fetchCalls += 1;
      assert.equal(
        String(input),
        "https://example.com/api/v1/finance/collect?corp_code=00126380",
      );
      assert.equal(init?.method, "POST");

      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), "Bearer test-access-token");
      assert.equal(headers.get("content-type"), "application/json");
      assert.equal(await new Response(init?.body).text(), '{"year":2025}');

      return new Response("upstream response", {
        status: 202,
        statusText: "Accepted",
        headers: { "Content-Type": "text/plain" },
      });
    },
    async () => {
      await withUpstreamOrigin("https://example.com/base-path", async () => {
        const response = await POST(
          new Request(
            "https://frontend.example/api/v1/finance/collect?corp_code=00126380",
            {
              method: "POST",
              headers: {
                Authorization: "Bearer test-access-token",
                "Content-Type": "application/json",
              },
              body: '{"year":2025}',
            },
          ),
          routeContext("v1", "finance", "collect"),
        );

        assert.equal(response.status, 202);
        assert.equal(response.statusText, "Accepted");
        assert.equal(response.headers.get("content-type"), "text/plain");
        assert.equal(await response.text(), "upstream response");
      });
    },
  );

  assert.equal(fetchCalls, 1);
});

test("proxy filters request hop-by-hop, infrastructure, and Connection-nominated headers", async () => {
  await withMockFetch(
    async (_input, init) => {
      const headers = new Headers(init?.headers);

      assert.equal(headers.get("authorization"), "Bearer preserved");
      assert.equal(headers.get("x-safe"), "safe");
      assert.equal(headers.get("connection"), null);
      assert.equal(headers.get("keep-alive"), null);
      assert.equal(headers.get("x-remove-me"), null);
      assert.equal(headers.get("cf-connecting-ip"), null);
      assert.equal(headers.get("cf-ray"), null);
      assert.equal(headers.get("host"), null);
      assert.equal(headers.get("content-length"), null);

      return Response.json({ ok: true });
    },
    async () => {
      await withUpstreamOrigin("https://example.com", async () => {
        const response = await GET(
          new Request("https://frontend.example/api/v1/finance/summary", {
            headers: {
              Authorization: "Bearer preserved",
              Connection: "keep-alive, x-remove-me",
              "Keep-Alive": "timeout=5",
              "X-Remove-Me": "secret",
              "CF-Connecting-IP": "192.0.2.1",
              "CF-Ray": "test-ray",
              Host: "attacker.example",
              "X-Safe": "safe",
            },
          }),
          routeContext("v1", "finance", "summary"),
        );

        assert.equal(response.status, 200);
      });
    },
  );
});

test("proxy filters response hop-by-hop and Connection-nominated headers", async () => {
  await withMockFetch(
    async () =>
      new Response("safe body", {
        headers: {
          Connection: "keep-alive, x-upstream-secret",
          "Keep-Alive": "timeout=5",
          "X-Upstream-Secret": "remove",
          "X-Safe-Response": "preserve",
        },
      }),
    async () => {
      await withUpstreamOrigin("https://example.com", async () => {
        const response = await GET(
          new Request("https://frontend.example/api/v1/finance/summary"),
          routeContext("v1", "finance", "summary"),
        );

        assert.equal(response.headers.get("connection"), null);
        assert.equal(response.headers.get("keep-alive"), null);
        assert.equal(response.headers.get("x-upstream-secret"), null);
        assert.equal(response.headers.get("x-safe-response"), "preserve");
        assert.equal(await response.text(), "safe body");
      });
    },
  );
});

test("proxy maps _health and binds all supported Next.js handlers", async () => {
  const handlers: ProxyHandler[] = [GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS];
  handlers.forEach((handler) => assert.equal(handler, GET));

  await withMockFetch(
    async (input, init) => {
      assert.equal(String(input), "https://example.com/health?full=true");
      assert.equal(init?.method, "GET");
      assert.equal(init?.body, undefined);
      return Response.json({ status: "ok" });
    },
    async () => {
      await withUpstreamOrigin("https://example.com", async () => {
        const response = await GET(
          new Request("https://frontend.example/api/_health?full=true"),
          routeContext("_health"),
        );

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: "ok" });
      });
    },
  );
});

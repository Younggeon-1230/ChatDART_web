import assert from "node:assert/strict";
import test from "node:test";
import { createCompareShareLink } from "@/lib/api";

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

test("compare share save preserves its POST query contract and Bearer auth", async () => {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installAuthenticatedWindow();

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = init?.headers as Record<string, string>;

    assert.equal(url.pathname, "/api/v1/finance/compare/save");
    assert.deepEqual(url.searchParams.getAll("keywords"), ["삼성전자", "SK하이닉스"]);
    assert.equal(url.searchParams.get("unit"), "억원");
    assert.equal(init?.method, "POST");
    assert.equal(headers.Authorization, "Bearer test-access-token");
    assert.equal(headers["X-API-Key"], undefined);

    return Response.json({
      share_id: "saved-share",
      expires_at: "2026-10-08T00:00:00Z",
    });
  };

  try {
    const response = await createCompareShareLink(
      [" 삼성전자 ", "", " SK하이닉스 "],
      "억원"
    );
    assert.equal(response.share_id, "saved-share");
    assert.equal(response.expires_at, "2026-10-08T00:00:00Z");
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
});

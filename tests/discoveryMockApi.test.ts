import assert from "node:assert/strict";
import test from "node:test";

test("popular companies retains the USE_MOCK_API response path", async () => {
  const originalMockFlag = process.env.NEXT_PUBLIC_USE_MOCK_API;
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  process.env.NEXT_PUBLIC_USE_MOCK_API = "true";
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("mock mode must not make a network request");
  };

  try {
    const { getPopularCompanies } = await import("@/lib/api/discovery");
    const response = await getPopularCompanies({ limit: 2, window: "daily" });

    assert.equal(fetchCalls, 0);
    assert.equal(response.items.length, 2);
    assert.equal(response.window, "daily");
    assert.deepEqual(
      response.items.map((item) => item.rank),
      [1, 2]
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalMockFlag === undefined) {
      delete process.env.NEXT_PUBLIC_USE_MOCK_API;
    } else {
      process.env.NEXT_PUBLIC_USE_MOCK_API = originalMockFlag;
    }
  }
});

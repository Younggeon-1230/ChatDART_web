import assert from "node:assert/strict";
import test from "node:test";
import {
  getAiAnalysis,
  getAiAnalysisErrorMessage,
  getApiErrorStatus,
} from "../src/lib/api";

test("keeps an AI analysis 503 on the error path", async (context) => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;

  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => {
    requestCount += 1;

    return new Response(
      JSON.stringify({ detail: "prediction model unavailable" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  };

  await assert.rejects(getAiAnalysis("005930"), (error: unknown) => {
    assert.equal(getApiErrorStatus(error), 503);
    assert.equal(
      getAiAnalysisErrorMessage(error),
      "AI 분석을 잠시 이용할 수 없습니다. 잠시 후 다시 시도해 주세요."
    );
    return true;
  });

  assert.equal(requestCount, 1);
});

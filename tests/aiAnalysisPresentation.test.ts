import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAiAnalysisNarrative,
  resolvePredictionDisplayText,
} from "../src/lib/aiAnalysisPresentation";

test("uses AI summary when summary_available is true", () => {
  const result = resolveAiAnalysisNarrative({
    summary_available: true,
    summary: "기존 AI 요약입니다.",
    prediction_sentence: "이 문장은 표시하지 않습니다.",
  });

  assert.deepEqual(result, {
    label: "AI 요약",
    text: "기존 AI 요약입니다.",
  });
});

test("uses the backend prediction sentence when summary is unavailable", () => {
  const predictionSentence =
    "2025년 예측 결과는 예상 영업이익 약 3,186억 원입니다.";
  const result = resolveAiAnalysisNarrative({
    summary_available: false,
    summary: "표시하면 안 되는 요약입니다.",
    prediction_sentence: predictionSentence,
  });

  assert.deepEqual(result, {
    label: "예측 결과",
    text: predictionSentence,
  });
  assert.equal(result?.text, predictionSentence);
});

test("returns no narrative when unavailable prediction sentence is null", () => {
  assert.equal(
    resolveAiAnalysisNarrative({
      summary_available: false,
      prediction_sentence: null,
    }),
    null
  );
  assert.equal(
    resolveAiAnalysisNarrative({
      summary_available: true,
      summary: null,
    }),
    null
  );
});

test("keeps backend prediction display text unchanged", () => {
  const displayText = " 예상 영업이익 약 3,186억 원 ";
  assert.equal(
    resolvePredictionDisplayText({ prediction_display_text: displayText }),
    displayText
  );
});

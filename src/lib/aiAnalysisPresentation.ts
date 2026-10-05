import type { AiAnalysisResponse } from "@/types/api";

export type AiAnalysisNarrative = {
  label: "AI 요약" | "예측 결과";
  text: string;
};

function nonEmptyOriginalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function resolveAiAnalysisNarrative(
  analysis: AiAnalysisResponse | null | undefined
): AiAnalysisNarrative | null {
  if (analysis?.summary_available === true) {
    const summary = nonEmptyOriginalText(analysis.summary);
    return summary ? { label: "AI 요약", text: summary } : null;
  }

  if (analysis?.summary_available === false) {
    const predictionSentence = nonEmptyOriginalText(
      analysis.prediction_sentence
    );
    return predictionSentence
      ? { label: "예측 결과", text: predictionSentence }
      : null;
  }

  return null;
}

export function resolvePredictionDisplayText(
  analysis: AiAnalysisResponse | null | undefined
) {
  return nonEmptyOriginalText(analysis?.prediction_display_text);
}

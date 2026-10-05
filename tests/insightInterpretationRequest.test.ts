import assert from "node:assert/strict";
import test from "node:test";
import { buildInsightInterpretationRequest } from "@/lib/api";
import type { FinancialInsight } from "@/lib/financialInsights";

function makeInsight(
  overrides: Partial<FinancialInsight> = {}
): FinancialInsight {
  return {
    id: "precision-fixture",
    type: "positive",
    title: "precision fixture",
    description: "precision fixture",
    year: 2025,
    evidence: [],
    ...overrides,
  };
}

test("canonicalizes interpretation change rates to at most two decimals", () => {
  const insight = makeInsight({
    evidence: [
      {
        label: "긴 소수",
        currentValue: 119.46503102055171,
        changeRate: 19.465031020551713,
      },
      {
        label: "반올림 경계",
        currentValue: 119.465,
        changeRate: 19.465,
      },
      {
        label: "기존 canonical 값",
        currentValue: 119.4,
        changeRate: 19.4,
      },
      {
        label: "음수",
        currentValue: 80.535,
        changeRate: -19.465,
      },
    ],
  });

  const payload = buildInsightInterpretationRequest({
    stockCode: "005930",
    company: "삼성전자",
    latestYear: 2025,
    insights: [insight],
  });

  assert.deepEqual(
    payload.positive_flags[0]?.evidence.map((item) => item.changeRate),
    [19.47, 19.47, 19.4, -19.47]
  );
});

test("preserves explicit null change rates and separate OCF ratio precision", () => {
  const insight = makeInsight({
    id: "operating-cash-flow-much-lower-than-net-income",
    type: "warning",
    evidence: [
      {
        label: "crossing-zero fixture",
        previousValue: -10,
        currentValue: 10,
        changeRate: null,
      },
      {
        label: "영업활동현금흐름/순이익 비율",
        previousValue: null,
        currentValue: 33.33,
        changeRate: null,
      },
    ],
  });

  const payload = buildInsightInterpretationRequest({
    stockCode: "035420",
    company: "NAVER",
    latestYear: 2025,
    insights: [insight],
  });

  assert.deepEqual(payload.warning_flags[0]?.evidence, [
    {
      label: "crossing-zero fixture",
      previousValue: -10,
      currentValue: 10,
      changeRate: null,
    },
    {
      label: "영업활동현금흐름/순이익 비율",
      previousValue: null,
      currentValue: 33.33,
      changeRate: null,
    },
  ]);
});

test("keeps Samsung-like warning and newer positive signals in their contract buckets", () => {
  const warning = makeInsight({
    id: "operating-margin-sharp-decline",
    type: "warning",
    year: 2023,
  });
  const positive = makeInsight({
    id: "revenue-and-operating-profit-up",
    type: "positive",
    year: 2025,
  });

  const payload = buildInsightInterpretationRequest({
    stockCode: "005930",
    company: "삼성전자",
    latestYear: 2025,
    insights: [warning, positive],
  });

  assert.equal(payload.warning_flags[0]?.year, 2023);
  assert.equal(payload.positive_flags[0]?.year, 2025);
});

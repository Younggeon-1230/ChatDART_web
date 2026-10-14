import assert from "node:assert/strict";
import test from "node:test";
import {
  sortFinancialInsightCardsForDisplay,
  type FinancialInsight,
  type FinancialInsightType,
} from "@/lib/financialInsights";

function insight(
  id: string,
  type: FinancialInsightType,
  year: number,
  evidenceLabels: string[]
): FinancialInsight {
  return {
    id,
    type,
    title: id,
    description: id,
    year,
    evidence: evidenceLabels.map((label) => ({
      label,
      currentValue: 1,
    })),
  };
}

test("shows the newest positive flow before an older warning", () => {
  const items = [
    insight("warning-2023", "warning", 2023, ["영업이익률"]),
    insight("positive-2025", "positive", 2025, ["영업이익"]),
    insight("positive-2024", "positive", 2024, ["영업이익"]),
  ];

  assert.deepEqual(
    sortFinancialInsightCardsForDisplay(items).map((item) => item.id),
    ["positive-2025", "positive-2024", "warning-2023"]
  );
});

test("prioritizes a newer warning over an older positive flow", () => {
  const items = [
    insight("positive-2024", "positive", 2024, ["영업이익"]),
    insight("warning-2025", "warning", 2025, ["영업이익률"]),
  ];

  assert.deepEqual(
    sortFinancialInsightCardsForDisplay(items).map((item) => item.id),
    ["warning-2025", "positive-2024"]
  );
});

test("uses complexity rather than polarity within the same year", () => {
  const singleWarning = insight("single-warning", "warning", 2025, [
    "영업이익률",
  ]);
  const compoundPositive = insight("compound-positive", "positive", 2025, [
    "매출액",
    "영업이익",
  ]);

  assert.deepEqual(
    sortFinancialInsightCardsForDisplay([
      singleWarning,
      compoundPositive,
    ]).map((item) => item.id),
    [compoundPositive.id, singleWarning.id]
  );
});

test("preserves source order when year and complexity are equal", () => {
  const first = insight("first", "positive", 2025, ["매출액", "영업이익"]);
  const second = insight("second", "warning", 2025, [
    "영업이익",
    "당기순이익",
  ]);
  const source = [first, second];

  assert.deepEqual(
    sortFinancialInsightCardsForDisplay(source).map((item) => item.id),
    [first.id, second.id]
  );
  assert.deepEqual(source, [first, second]);
});

test("handles positive-only and warning-only collections", () => {
  const positiveOnly = [
    insight("positive-2024", "positive", 2024, ["영업이익"]),
    insight("positive-2025", "positive", 2025, ["매출액"]),
  ];
  const warningOnly = [
    insight("warning-2024", "warning", 2024, ["영업이익률"]),
    insight("warning-2025", "warning", 2025, ["순이익률"]),
  ];

  assert.deepEqual(
    sortFinancialInsightCardsForDisplay(positiveOnly).map((item) => item.id),
    ["positive-2025", "positive-2024"]
  );
  assert.deepEqual(
    sortFinancialInsightCardsForDisplay(warningOnly).map((item) => item.id),
    ["warning-2025", "warning-2024"]
  );
});

test("returns an empty display collection for missing insights", () => {
  assert.deepEqual(sortFinancialInsightCardsForDisplay([]), []);
  assert.deepEqual(sortFinancialInsightCardsForDisplay(null), []);
  assert.deepEqual(sortFinancialInsightCardsForDisplay(undefined), []);
});

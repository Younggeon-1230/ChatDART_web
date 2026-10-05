import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeFinancialInsights,
  OCF_RATIO_MIN_NET_INCOME,
  OCF_TO_NET_INCOME_CAUTION_THRESHOLD,
  type FinancialInsight,
  type FinancialInsightInput,
} from "@/lib/financialInsights";
import {
  buildInsightInterpretationRequest,
  selectDisclosureRuleId,
} from "@/lib/api";
import { mockLowOperatingCashFlowInterpretationResponse } from "@/mock/api";

const RULE_ID = "operating-cash-flow-much-lower-than-net-income";
const YEAR = 2025;

function makeRow(
  netIncome: number | null,
  operatingCashFlow: number | null,
  isFinancialSector = false
): FinancialInsightInput {
  return {
    fiscal_year: YEAR,
    revenue: 100_000_000_000,
    operating_profit: 10_000_000_000,
    net_income: netIncome,
    operating_cash_flow: operatingCashFlow,
    is_financial_sector: isFinancialSector,
  };
}

function findRule(
  netIncome: number | null,
  operatingCashFlow: number | null,
  isFinancialSector = false
) {
  return analyzeFinancialInsights([
    makeRow(netIncome, operatingCashFlow, isFinancialSector),
  ]).find((insight) => insight.id === RULE_ID);
}

test("uses the final named thresholds", () => {
  assert.equal(OCF_RATIO_MIN_NET_INCOME, 10_000_000_000);
  assert.equal(OCF_TO_NET_INCOME_CAUTION_THRESHOLD, 0.4);
});

test("creates the formal warning and its exact three evidence rows", () => {
  const insight = findRule(10_000_000_000, 3_500_000_000);

  assert.ok(insight);
  assert.equal(insight.type, "warning");
  assert.equal(insight.title, "순이익 대비 영업활동현금흐름이 낮음");
  assert.deepEqual(
    insight.evidence.map(
      ({ label, previousValue, currentValue, changeRate }) => ({
        label,
        previousValue,
        currentValue,
        changeRate,
      })
    ),
    [
      {
        label: "당기순이익",
        previousValue: null,
        currentValue: 10_000_000_000,
        changeRate: null,
      },
      {
        label: "영업활동현금흐름",
        previousValue: null,
        currentValue: 3_500_000_000,
        changeRate: null,
      },
      {
        label: "영업활동현금흐름/순이익 비율",
        previousValue: null,
        currentValue: 35,
        changeRate: null,
      },
    ]
  );
});

test("truncates boundary percentages to two decimal places", () => {
  const netIncome = 100_000_000_000;

  for (const [ratio, expected] of [
    [0.39949, 39.94],
    [0.3995, 39.95],
    [0.39999, 39.99],
  ] as const) {
    const insight = findRule(netIncome, netIncome * ratio);
    assert.ok(insight, `${ratio} should match`);
    assert.equal(insight.evidence[2]?.currentValue, expected);
    assert.equal(insight.evidence[2]?.displayFractionDigits, 2);
  }

  assert.equal(findRule(netIncome, netIncome * 0.4), undefined);
});

test("does not match excluded null, zero, threshold, or financial cases", () => {
  const cases = [
    makeRow(100_000_000_000, 40_000_000_001),
    makeRow(100_000_000_000, 0),
    makeRow(100_000_000_000, -1),
    makeRow(OCF_RATIO_MIN_NET_INCOME - 1, 1),
    makeRow(null, 1),
    makeRow(100_000_000_000, null),
    makeRow(100_000_000_000, 1, true),
    {
      fiscal_year: YEAR,
      revenue: null,
      operating_profit: null,
      net_income: 100_000_000_000,
      operating_cash_flow: null,
      is_financial_sector: true,
    },
  ];

  cases.forEach((row) => {
    assert.equal(
      analyzeFinancialInsights([row]).some((insight) => insight.id === RULE_ID),
      false
    );
  });
});

test("keeps negative OCF exclusive to the existing negative-cash-flow warning", () => {
  const matchingIds = analyzeFinancialInsights([
    makeRow(100_000_000_000, -1),
  ]).map((insight) => insight.id);

  assert.equal(matchingIds.includes(RULE_ID), false);
  assert.equal(
    matchingIds.includes("net-income-positive-operating-cash-flow-negative"),
    true
  );
});

test("includes the formal warning in Phase 97 and Phase 98 mapping", () => {
  const insight = findRule(100_000_000_000, 35_000_000_000);
  assert.ok(insight);

  const payload = buildInsightInterpretationRequest({
    stockCode: "035420",
    company: "NAVER",
    latestYear: YEAR,
    insights: [insight],
  });

  assert.deepEqual(
    payload.warning_flags.map((flag) => flag.id),
    [RULE_ID]
  );
  assert.deepEqual(
    payload.warning_flags[0]?.evidence,
    [
      {
        label: "당기순이익",
        previousValue: null,
        currentValue: 100_000_000_000,
        changeRate: null,
      },
      {
        label: "영업활동현금흐름",
        previousValue: null,
        currentValue: 35_000_000_000,
        changeRate: null,
      },
      {
        label: "영업활동현금흐름/순이익 비율",
        previousValue: null,
        currentValue: 35,
        changeRate: null,
      },
    ]
  );
  assert.equal(selectDisclosureRuleId([insight]), RULE_ID);
});

test("preserves existing representative warning-before-positive ordering", () => {
  const positive: FinancialInsight = {
    id: "positive-fixture",
    type: "positive",
    title: "positive",
    description: "positive",
    year: YEAR,
    evidence: [],
  };
  const warning = findRule(100_000_000_000, 35_000_000_000);
  assert.ok(warning);

  assert.equal(selectDisclosureRuleId([positive, warning]), RULE_ID);
});

test("keeps the one-item AI check_items fixture unchanged", () => {
  assert.deepEqual(
    mockLowOperatingCashFlowInterpretationResponse.interpretation?.check_items,
    ["영업활동현금흐름"]
  );
});

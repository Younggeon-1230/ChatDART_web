import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeMetricTrend,
  buildComprehensiveFinancialAnalysis,
} from "../src/lib/financialTrendAnalysis";
import type { YearlyDataApi } from "../src/types/api.ts";

function row(
  fiscalYear: number,
  values: Partial<YearlyDataApi> = {}
): YearlyDataApi {
  return {
    fiscal_year: fiscalYear,
    revenue: null,
    cost_of_sales: null,
    gross_profit: null,
    sga: null,
    operating_profit: null,
    other_income: null,
    other_expense: null,
    finance_income: null,
    finance_cost: null,
    income_before_tax: null,
    income_tax_expense: null,
    net_income: null,
    operating_cash_flow: null,
    total_assets: null,
    total_liabilities: null,
    equity: null,
    cash: null,
    ...values,
  };
}

function points(values: Array<number | null>) {
  return values.map((value, index) => ({ year: 2021 + index, value }));
}

test("classifies steady improvement", () => {
  const result = analyzeMetricTrend(points([100, 110, 120, 130, 140]));
  assert.equal(result.direction, "up");
  assert.equal(result.recentDirection, "up");
  assert.equal(result.consecutiveYears, 4);
  assert.equal(result.inflectionYear, undefined);
});

test("classifies persistent deterioration", () => {
  const result = analyzeMetricTrend(points([140, 130, 120, 110, 100]));
  assert.equal(result.direction, "down");
  assert.equal(result.recentDirection, "down");
  assert.equal(result.consecutiveYears, 4);
});

test("finds a drop followed by a two-year recovery", () => {
  const result = analyzeMetricTrend(points([100, 70, 50, 70, 90]));
  assert.equal(result.direction, "volatile");
  assert.equal(result.recentDirection, "up");
  assert.equal(result.consecutiveYears, 2);
  assert.equal(result.inflectionYear, 2023);
});

test("classifies alternating values as volatile", () => {
  const result = analyzeMetricTrend(points([100, 120, 90, 115, 95]));
  assert.equal(result.direction, "volatile");
  assert.equal(result.recentDirection, "mixed");
});

test("returns insufficient when fewer than two valid values remain", () => {
  const result = analyzeMetricTrend(points([null, null, 100, null, null]));
  assert.equal(result.direction, "insufficient");
  assert.equal(result.latestValue, 100);
});

test("keeps nulls missing instead of treating them as zero", () => {
  const result = analyzeMetricTrend(points([100, null, 120, null, 140]));
  assert.equal(result.direction, "up");
  assert.equal(result.firstValue, 100);
  assert.equal(result.latestValue, 140);
});

test("classifies conflicting core metrics as mixed", () => {
  const history = [2021, 2022, 2023, 2024, 2025].map((year, index) =>
    row(year, {
      revenue: 100 + index * 10,
      operating_profit: 50 - index * 5,
      net_income: 30 + index * 3,
      operating_cash_flow: 25 - index * 3,
    })
  );
  const result = buildComprehensiveFinancialAnalysis(history, {
    isFinancialSector: false,
  });
  assert.equal(result.status, "mixed");
  assert.match(result.flowSummary, /방향이 엇갈립니다/);
});

test("classifies an internal low followed by recovery as recovering", () => {
  const values = [100, 70, 50, 70, 90];
  const history = values.map((value, index) =>
    row(2021 + index, {
      revenue: value * 10,
      operating_profit: value,
      net_income: value * 0.8,
      operating_cash_flow: value * 0.9,
    })
  );
  const result = buildComprehensiveFinancialAnalysis(history, {
    isFinancialSector: false,
  });
  assert.equal(result.status, "recovering");
  assert.equal(result.changes.length <= 2, true);
});

test("classifies consistently improving financial metrics as improving", () => {
  const history = [100, 110, 120, 130, 140].map((value, index) =>
    row(2021 + index, {
      revenue: value * 10,
      operating_profit: value,
      net_income: value * 0.8,
      operating_cash_flow: value * 0.9,
    })
  );
  const result = buildComprehensiveFinancialAnalysis(history, {
    isFinancialSector: false,
  });
  assert.equal(result.status, "improving");
});

test("classifies consistently weakening financial metrics as deteriorating", () => {
  const history = [140, 130, 120, 110, 100].map((value, index) =>
    row(2021 + index, {
      revenue: value * 10,
      operating_profit: value,
      net_income: value * 0.8,
      operating_cash_flow: value * 0.9,
    })
  );
  const result = buildComprehensiveFinancialAnalysis(history, {
    isFinancialSector: false,
  });
  assert.equal(result.status, "deteriorating");
});

test("uses the correct particle for weakening after an internal peak", () => {
  const cases = [
    {
      revenueValues: [100, 140, 120, 100, 80],
      expected: "2022년 매출 고점 이후 2023~2025년 약화가 이어졌습니다.",
    },
    {
      revenueValues: [80, 100, 140, 120, 100],
      expected: "2023년 매출 고점 이후 2024~2025년 약화가 이어졌습니다.",
    },
  ];

  cases.forEach(({ revenueValues, expected }) => {
    const history = revenueValues.map((revenue, index) =>
      row(2021 + index, {
        revenue,
        operating_profit: 10,
      })
    );
    const result = buildComprehensiveFinancialAnalysis(history, {
      isFinancialSector: false,
    });

    assert.equal(result.changes.includes(expected), true);
    assert.equal(
      result.changes.some((change) => change.includes("약화이")),
      false
    );
  });
});

test("returns insufficient for only two fiscal years", () => {
  const history = [2024, 2025].map((year, index) =>
    row(year, { revenue: 100 + index * 10, operating_profit: 10 + index })
  );
  const result = buildComprehensiveFinancialAnalysis(history, {
    isFinancialSector: false,
  });
  assert.equal(result.status, "insufficient");
  assert.match(result.flowSummary, /데이터가 부족합니다/);
});

test("finance analysis excludes structurally null operating metrics", () => {
  const history = [2021, 2022, 2023, 2024, 2025].map((year, index) =>
    row(year, {
      revenue: null,
      operating_profit: null,
      operating_margin: null,
      operating_cash_flow: null,
      net_income: 100 + index * 10,
      total_assets: 1_000 + index * 50,
      total_liabilities: 500 + index * 10,
      equity: 500 + index * 40,
    })
  );
  const result = buildComprehensiveFinancialAnalysis(history, {
    isFinancialSector: true,
  });
  assert.deepEqual(
    result.metricTrends.map((metric) => metric.key),
    ["net_income", "roe", "roa", "debt_ratio"]
  );
  assert.equal(result.currentMetrics.some((metric) => metric.value === 0), false);
  assert.doesNotMatch(result.flowSummary, /매출|영업이익/);
});

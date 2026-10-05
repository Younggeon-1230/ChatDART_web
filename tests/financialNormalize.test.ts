import assert from "node:assert/strict";
import test from "node:test";
import { formatPercent } from "@/lib/format";
import { getFinancialMetricValue } from "@/lib/financialNormalize";
import type { YearlyDataApi } from "@/types/api";

function makeYear(
  fiscalYear: number,
  overrides: Partial<YearlyDataApi> = {}
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
    ...overrides,
  };
}

test("preserves direct revenue growth rates that are already percent values", () => {
  for (const value of [0.5, 0.91, 1, 1.01, 10, -0.5, -0.91, -1]) {
    const history = [
      makeYear(2022, { revenue: 100 }),
      makeYear(2023, { revenue: 101, revenue_growth_rate: value }),
    ];

    assert.equal(
      getFinancialMetricValue(history, "revenue_growth_rate", 2023),
      value,
      `${value}% should remain in percent units`
    );
  }
});

test("displays the production LG Electronics 2023 growth rate as 0.9%", () => {
  const history = [
    makeYear(2022, { revenue: 83_467_318_000_000, revenue_growth_rate: 12.93 }),
    makeYear(2023, { revenue: 84_227_765_000_000, revenue_growth_rate: 0.91 }),
  ];
  const value = getFinancialMetricValue(
    history,
    "revenue_growth_rate",
    2023
  );

  assert.equal(value, 0.91);
  assert.equal(formatPercent(value, 1), "0.9%");
});

test("calculates revenue growth from revenue when the direct field is missing", () => {
  const growthHistory = [
    makeYear(2022, { revenue: 100 }),
    makeYear(2023, { revenue: 101 }),
  ];
  const declineHistory = [
    makeYear(2022, { revenue: 100 }),
    makeYear(2023, { revenue: 99 }),
  ];

  assert.equal(
    getFinancialMetricValue(growthHistory, "revenue_growth_rate", 2023),
    1
  );
  assert.equal(
    getFinancialMetricValue(declineHistory, "revenue_growth_rate", 2023),
    -1
  );
});

test("keeps ratio-to-percent normalization for margin fields", () => {
  const history = [
    makeYear(2023, {
      operating_margin: 0.4,
      net_margin: -0.5,
    }),
  ];

  assert.equal(getFinancialMetricValue(history, "operating_margin", 2023), 40);
  assert.equal(getFinancialMetricValue(history, "net_margin", 2023), -50);
});

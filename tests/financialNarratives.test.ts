import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFinancialPositionSummary,
  buildProfitabilityGrowthSummary,
  buildSummaryTextCards,
} from "@/lib/financialNarratives";
import type { YearlyDataApi } from "@/types/api";

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

test("매출 성장과 이익률 개선의 동반 흐름을 설명한다", () => {
  const previous = row(2024, {
    revenue: 100,
    operating_margin: 10,
    net_margin: 8,
  });
  const latest = row(2025, {
    revenue: 150,
    operating_margin: 12,
    net_margin: 9,
  });

  const summary = buildProfitabilityGrowthSummary(latest, previous);

  assert.match(summary, /매출은 전년 대비 50\.0% 증가/);
  assert.match(summary, /외형 성장과 수익성 개선이 함께/);
});

test("매출 성장과 이익률 약화를 수익성 압박으로 설명한다", () => {
  const previous = row(2024, {
    revenue: 100,
    operating_margin: 15,
    net_margin: 12,
  });
  const latest = row(2025, {
    revenue: 120,
    operating_margin: 12,
    net_margin: 9,
  });

  const summary = buildProfitabilityGrowthSummary(latest, previous);

  assert.match(summary, /외형은 성장했지만 이익률은 낮아져/);
  assert.match(summary, /성장만큼 수익성이 따라오지 못/);
});

test("매출 감소 중 유지된 이익률을 수익성 방어로 설명한다", () => {
  const previous = row(2024, {
    revenue: 100,
    operating_margin: 10,
    net_margin: 8,
  });
  const latest = row(2025, {
    revenue: 90,
    operating_margin: 10,
    net_margin: 8,
  });

  const summary = buildProfitabilityGrowthSummary(latest, previous);

  assert.match(summary, /외형은 감소했지만/);
  assert.match(summary, /수익성 방어/);
});

test("매출과 이익률의 동반 하락을 함께 설명한다", () => {
  const previous = row(2024, {
    revenue: 100,
    operating_margin: 10,
    net_margin: 8,
  });
  const latest = row(2025, {
    revenue: 80,
    operating_margin: 7,
    net_margin: 5,
  });

  const summary = buildProfitabilityGrowthSummary(latest, previous);

  assert.match(summary, /외형과 수익성이 동반 약화/);
});

test("일부 margin이 없으면 사용 가능한 값만 설명한다", () => {
  const previous = row(2024, { revenue: 100, operating_margin: 10 });
  const latest = row(2025, {
    revenue: 110,
    operating_margin: 12,
    net_margin: null,
  });

  const summary = buildProfitabilityGrowthSummary(latest, previous);

  assert.match(summary, /영업이익률 12\.0%/);
  assert.doesNotMatch(summary, /순이익률/);
});

test("자본이 부채보다 큰 자본조달 구조를 설명한다", () => {
  const summary = buildFinancialPositionSummary(
    row(2025, {
      total_assets: 176_107_700_000_000,
      total_liabilities: 55_440_900_000_000,
      equity: 120_666_800_000_000,
    })
  );

  assert.match(summary, /자본이 부채보다 큰 구조/);
  assert.match(summary, /자기자본 비중이 상대적으로 크/);
});

test("부채 비중이 자본보다 큰 자본조달 구조를 설명한다", () => {
  const summary = buildFinancialPositionSummary(
    row(2025, {
      total_assets: 150,
      total_liabilities: 100,
      equity: 50,
    })
  );

  assert.match(summary, /부채 비중이 자본보다 큰 구조/);
});

test("부채 수준에 좋음이나 위험 같은 가치 판단을 붙이지 않는다", () => {
  const summaries = [
    buildFinancialPositionSummary(
      row(2025, { total_assets: 300, total_liabilities: 200, equity: 100 })
    ),
    buildFinancialPositionSummary(
      row(2025, { total_assets: 150, total_liabilities: 50, equity: 100 })
    ),
  ];

  summaries.forEach((summary) => {
    assert.doesNotMatch(summary, /안전|안정적|우수|위험|나쁘|건전/);
    assert.match(summary, /업종 특성과 함께/);
  });
});

test("일부 재무상태 값이 없으면 임의 관계를 만들지 않는다", () => {
  const summary = buildFinancialPositionSummary(
    row(2025, { total_assets: 150, total_liabilities: null, equity: 100 })
  );

  assert.match(summary, /관계를 판단할 데이터가 충분하지 않아/);
  assert.doesNotMatch(summary, /자본이 부채보다|부채 비중이 자본보다|부채 0/);
});

test("기존 손익 요약은 매출과 영업이익의 전년 대비 변화를 유지한다", () => {
  const cards = buildSummaryTextCards([
    row(2024, { revenue: 100, operating_profit: 10 }),
    row(2025, { revenue: 120, operating_profit: 12 }),
  ]);
  const profitSummary = cards.find((card) => card.title === "손익 요약");

  assert.ok(profitSummary);
  assert.match(profitSummary.content, /매출은 .*전년 대비 20\.0% 증가/);
  assert.match(profitSummary.content, /영업이익은 .*전년 대비 20\.0% 증가/);
});

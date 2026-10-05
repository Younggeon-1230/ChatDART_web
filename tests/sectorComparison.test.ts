import assert from "node:assert/strict";
import test from "node:test";
import { buildSectorComparisonItems } from "@/lib/sectorComparison";
import type { SectorAverageApi } from "@/types/api";

const companyMetrics = {
  revenue_growth_rate: 12.5,
  operating_margin: 8.6,
  net_margin: 6.2,
  roe: 9.4,
  roa: 4.1,
  debt_ratio: 105,
};

const sectorAverage: SectorAverageApi = {
  revenue_growth_rate: 7.5,
  operating_margin: 6.4,
  net_margin: 4.8,
  roe: 8.9,
  roa: 3.5,
  debt_ratio: 120,
};

test("일반 기업에서 회사 값과 평균이 모두 유효한 지표를 순서대로 생성한다", () => {
  const result = buildSectorComparisonItems({
    companyMetrics,
    sectorAverage,
    sectorRank: null,
    isFinancialSector: false,
  });

  assert.deepEqual(
    result.map((item) => item.key),
    [
      "revenue_growth_rate",
      "operating_margin",
      "net_margin",
      "roe",
      "roa",
      "debt_ratio",
    ]
  );
});

test("업종 평균이 null인 지표를 제외한다", () => {
  const result = buildSectorComparisonItems({
    companyMetrics,
    sectorAverage: { ...sectorAverage, roe: null },
    sectorRank: null,
    isFinancialSector: false,
  });

  assert.equal(result.some((item) => item.key === "roe"), false);
});

test("회사 값이 null인 지표를 제외하고 0으로 변환하지 않는다", () => {
  const result = buildSectorComparisonItems({
    companyMetrics: { ...companyMetrics, net_margin: null },
    sectorAverage,
    sectorRank: null,
    isFinancialSector: false,
  });

  assert.equal(result.some((item) => item.key === "net_margin"), false);
});

test("0은 유효한 비교 값으로 유지한다", () => {
  const result = buildSectorComparisonItems({
    companyMetrics: { roe: 0 },
    sectorAverage: { roe: 0 },
    sectorRank: null,
    isFinancialSector: false,
  });

  assert.deepEqual(result[0], {
    key: "roe",
    label: "ROE",
    companyValue: 0,
    sectorAverage: 0,
    signed: false,
    rank: null,
    totalCompanies: null,
  });
});

test("revenue_rank와 total_companies를 매출 성장률 항목에 연결한다", () => {
  const result = buildSectorComparisonItems({
    companyMetrics,
    sectorAverage,
    sectorRank: { revenue_rank: 2, total_companies: 4 },
    isFinancialSector: false,
  });
  const revenueGrowth = result.find(
    (item) => item.key === "revenue_growth_rate"
  );

  assert.equal(revenueGrowth?.rank, 2);
  assert.equal(revenueGrowth?.totalCompanies, 4);
});

test("operating_margin_rank를 영업이익률 항목에 연결한다", () => {
  const result = buildSectorComparisonItems({
    companyMetrics,
    sectorAverage,
    sectorRank: { operating_margin_rank: 3, total_companies: 8 },
    isFinancialSector: false,
  });
  const operatingMargin = result.find(
    (item) => item.key === "operating_margin"
  );

  assert.equal(operatingMargin?.rank, 3);
  assert.equal(operatingMargin?.totalCompanies, 8);
});

test("rank가 없으면 순위 데이터를 비워 둔다", () => {
  const result = buildSectorComparisonItems({
    companyMetrics,
    sectorAverage,
    sectorRank: { total_companies: 4 },
    isFinancialSector: false,
  });

  assert.equal(result.every((item) => item.rank === null), true);
  assert.equal(result.every((item) => item.totalCompanies === null), true);
});

test("금융업에서는 구조적으로 부적절한 매출과 마진 계열을 제외한다", () => {
  const result = buildSectorComparisonItems({
    companyMetrics,
    sectorAverage,
    sectorRank: { roe_rank: 1, total_companies: 5 },
    isFinancialSector: true,
  });

  assert.deepEqual(
    result.map((item) => item.key),
    ["roe", "roa", "debt_ratio"]
  );
});

test("비교 가능한 지표가 없으면 빈 목록을 반환한다", () => {
  assert.deepEqual(
    buildSectorComparisonItems({
      companyMetrics: {},
      sectorAverage: null,
      sectorRank: null,
      isFinancialSector: false,
    }),
    []
  );
});

test("유효하지 않은 rank나 표본 합계는 표시 데이터로 사용하지 않는다", () => {
  const result = buildSectorComparisonItems({
    companyMetrics: { roe: 5 },
    sectorAverage: { roe: 4 },
    sectorRank: { roe_rank: 3, total_companies: 2 },
    isFinancialSector: false,
  });

  assert.equal(result[0]?.rank, 3);
  assert.equal(result[0]?.totalCompanies, null);
});

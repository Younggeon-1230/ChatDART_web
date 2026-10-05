import assert from "node:assert/strict";
import test from "node:test";
import {
  getDashboardRecentSearchStockCode,
  selectDashboardRecentSearches,
} from "@/lib/dashboardRecentSearches";
import type { DashboardRecentSearchItemApi } from "@/types/api";

function recentSearch(
  companyName: string,
  stockCode: string | null,
  searchedAt?: string
): DashboardRecentSearchItemApi {
  return {
    company_name: companyName,
    stock_code: stockCode,
    searched_at: searchedAt,
  };
}

test("동일 stockCode는 가장 최근 검색 한 건만 유지한다", () => {
  const oldNetmarble = recentSearch(
    "넷마블",
    "251270",
    "2026-09-20T10:00:00Z"
  );
  const samsung = recentSearch(
    "삼성전자",
    "005930",
    "2026-09-22T10:00:00Z"
  );
  const latestNetmarble = recentSearch(
    "넷마블",
    "251270",
    "2026-09-23T10:00:00Z"
  );

  assert.deepEqual(
    selectDashboardRecentSearches([oldNetmarble, samsung, latestNetmarble]),
    [latestNetmarble, samsung]
  );
});

test("같은 기업을 다시 검색하면 최신 위치로 이동한다", () => {
  const result = selectDashboardRecentSearches([
    recentSearch("넷마블", "251270", "2026-09-20T10:00:00Z"),
    recentSearch("삼성전자", "005930", "2026-09-21T10:00:00Z"),
    recentSearch("넷마블", "251270", "2026-09-22T10:00:00Z"),
  ]);

  assert.deepEqual(
    result.map((item) => item.company_name),
    ["넷마블", "삼성전자"]
  );
});

test("서로 다른 stockCode는 회사명이 같아도 유지한다", () => {
  const result = selectDashboardRecentSearches([
    recentSearch("동일 이름", "000001"),
    recentSearch("동일 이름", "000002"),
  ]);

  assert.equal(result.length, 2);
});

test("null 또는 잘못된 stockCode는 서로 합치지 않는다", () => {
  const result = selectDashboardRecentSearches([
    recentSearch("이름만 있는 기업", null),
    recentSearch("이름만 있는 기업", null),
    recentSearch("잘못된 코드", "invalid"),
    recentSearch("잘못된 코드", "invalid"),
  ]);

  assert.equal(result.length, 4);
});

test("snake_case가 잘못되어도 유효한 camelCase stockCode를 사용한다", () => {
  const item: DashboardRecentSearchItemApi = {
    stock_code: "invalid",
    stockCode: " 005930 ",
  };

  assert.equal(getDashboardRecentSearchStockCode(item), "005930");
});

test("중복 제거 후 최대 5건만 유지한다", () => {
  const result = selectDashboardRecentSearches([
    recentSearch("기업 1", "000001"),
    recentSearch("기업 1 중복", "000001"),
    recentSearch("기업 2", "000002"),
    recentSearch("기업 3", "000003"),
    recentSearch("기업 4", "000004"),
    recentSearch("기업 5", "000005"),
    recentSearch("기업 6", "000006"),
  ]);

  assert.deepEqual(
    result.map((item) => item.stock_code),
    ["000001", "000002", "000003", "000004", "000005"]
  );
});

test("이미 unique이고 timestamp가 없으면 입력 순서를 유지한다", () => {
  const items = [
    recentSearch("삼성전자", "005930"),
    recentSearch("넷마블", "251270"),
  ];

  assert.deepEqual(selectDashboardRecentSearches(items), items);
});

test("빈 목록을 정상 처리한다", () => {
  assert.deepEqual(selectDashboardRecentSearches([]), []);
});

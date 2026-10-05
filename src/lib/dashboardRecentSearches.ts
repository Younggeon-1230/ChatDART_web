import type { DashboardRecentSearchItemApi } from "@/types/api";

export const MAX_DASHBOARD_RECENT_SEARCHES = 5;

function normalizeStockCode(value: unknown) {
  if (typeof value !== "string") return null;

  const stockCode = value.trim();
  return /^\d{6}$/.test(stockCode) ? stockCode : null;
}

export function getDashboardRecentSearchStockCode(
  item: DashboardRecentSearchItemApi
) {
  return (
    normalizeStockCode(item.stock_code) ?? normalizeStockCode(item.stockCode)
  );
}

function getRecentSearchTimestamp(item: DashboardRecentSearchItemApi) {
  for (const value of [item.searched_at, item.viewed_at]) {
    if (typeof value !== "string" || !value.trim()) continue;

    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return timestamp;
  }

  return null;
}

export function selectDashboardRecentSearches(
  items: DashboardRecentSearchItemApi[],
  limit = MAX_DASHBOARD_RECENT_SEARCHES
) {
  if (limit <= 0) return [];

  const newestFirst = items
    .map((item, index) => ({
      item,
      index,
      timestamp: getRecentSearchTimestamp(item),
    }))
    .sort((a, b) => {
      if (a.timestamp !== null && b.timestamp !== null) {
        return b.timestamp - a.timestamp || a.index - b.index;
      }

      if (a.timestamp !== null) return -1;
      if (b.timestamp !== null) return 1;

      return a.index - b.index;
    });
  const seenStockCodes = new Set<string>();
  const selected: DashboardRecentSearchItemApi[] = [];

  for (const { item } of newestFirst) {
    const stockCode = getDashboardRecentSearchStockCode(item);

    if (stockCode) {
      if (seenStockCodes.has(stockCode)) continue;
      seenStockCodes.add(stockCode);
    }

    selected.push(item);
    if (selected.length === limit) break;
  }

  return selected;
}

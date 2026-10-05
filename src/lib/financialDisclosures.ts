import type { FinancialDisclosureApi } from "@/types/api";

export const MAX_RELATED_DISCLOSURES = 3;

function getPeriodicReportPriority(title: string) {
  if (title.includes("사업보고서")) return 0;
  if (title.includes("반기보고서")) return 1;
  if (title.includes("분기보고서")) return 2;
  return 4;
}

function getDisclosurePriority(disclosure: FinancialDisclosureApi) {
  if (disclosure.category === "periodic") {
    return getPeriodicReportPriority(disclosure.title);
  }

  if (disclosure.category === "performance") return 3;
  return 5;
}

function getDisclosureTimestamp(date: string) {
  const timestamp = Date.parse(date);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function getDisclosureKey(disclosure: FinancialDisclosureApi) {
  return [disclosure.viewer_url, disclosure.date, disclosure.title]
    .map((value) => value.trim())
    .join("\u0000");
}

export function selectRelatedDisclosures(
  disclosures: readonly FinancialDisclosureApi[],
  limit = MAX_RELATED_DISCLOSURES
) {
  if (limit <= 0) return [];

  const seen = new Set<string>();
  const uniqueDisclosures = disclosures.filter((disclosure) => {
    const key = getDisclosureKey(disclosure);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueDisclosures
    .map((disclosure, index) => ({ disclosure, index }))
    .sort((left, right) => {
      const priorityDifference =
        getDisclosurePriority(left.disclosure) -
        getDisclosurePriority(right.disclosure);

      if (priorityDifference !== 0) return priorityDifference;

      const dateDifference =
        getDisclosureTimestamp(right.disclosure.date) -
        getDisclosureTimestamp(left.disclosure.date);

      return dateDifference || left.index - right.index;
    })
    .slice(0, limit)
    .map(({ disclosure }) => disclosure);
}

export type RecentCompany = {
  name: string;
  viewedAt: string;
  corpCode?: string;
  stockCode?: string;
  market?: string;
  sector?: string;
  business?: string;
};

type RecentCompanyInput =
  | string
  | {
      name?: string | null;
      displayName?: string | null;
      display_name?: string | null;
      companyName?: string | null;
      company_name?: string | null;
      corpName?: string | null;
      corp_name?: string | null;
      corpCode?: string | null;
      corp_code?: string | null;
      stockCode?: string | null;
      stock_code?: string | null;
      code?: string | null;
      market?: string | null;
      sector?: string | null;
      business?: string | null;
    };

const RECENT_COMPANIES_KEY = "recentCompanies";
const MAX_RECENT_COMPANIES = 10;

function normalizeRecentCompanyKey(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

function isSameRecentCompany(a: RecentCompany, b: RecentCompany) {
  if (a.stockCode && b.stockCode) {
    return a.stockCode === b.stockCode;
  }

  if (a.corpCode && b.corpCode) {
    return a.corpCode === b.corpCode;
  }

  return normalizeRecentCompanyKey(a.name) === normalizeRecentCompanyKey(b.name);
}

function normalizeRecentCompanyItem(item: unknown): RecentCompany | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const rawName = record.name ?? record.companyName ?? record.displayName;
  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (!name) {
    return null;
  }

  const viewedAt =
    typeof record.viewedAt === "string" && record.viewedAt.trim()
      ? record.viewedAt
      : new Date().toISOString();
  const stockCode =
    typeof record.stockCode === "string" && record.stockCode.trim()
      ? record.stockCode.trim()
      : typeof record.code === "string" && record.code.trim()
        ? record.code.trim()
        : undefined;
  const corpCode =
    typeof record.corpCode === "string" && record.corpCode.trim()
      ? record.corpCode.trim()
      : undefined;

  return {
    name,
    viewedAt,
    corpCode,
    stockCode,
    market:
      typeof record.market === "string" && record.market.trim()
        ? record.market.trim()
        : undefined,
    sector:
      typeof record.sector === "string" && record.sector.trim()
        ? record.sector.trim()
        : undefined,
    business:
      typeof record.business === "string" && record.business.trim()
        ? record.business.trim()
        : undefined,
  };
}

export function getRecentCompanies(): RecentCompany[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_COMPANIES_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeRecentCompanyItem)
      .filter((item): item is RecentCompany => item !== null)
      .slice(0, MAX_RECENT_COMPANIES);
  } catch {
    return [];
  }
}

export function addRecentCompany(
  company: RecentCompanyInput
) {
  if (typeof window === "undefined") {
    return [];
  }

  const name =
    typeof company === "string"
      ? company.trim()
      : (
          company.displayName ??
          company.display_name ??
          company.companyName ??
          company.company_name ??
          company.corpName ??
          company.corp_name ??
          company.name ??
          ""
        ).trim();
  const stockCode =
    typeof company === "string"
      ? undefined
      : (company.stockCode ?? company.stock_code ?? company.code)?.trim();
  const corpCode =
    typeof company === "string"
      ? undefined
      : (company.corpCode ?? company.corp_code)?.trim();

  if (!name || (!stockCode && !corpCode)) {
    return getRecentCompanies();
  }

  const nextCompany = {
    name,
    corpCode,
    stockCode,
    market: typeof company === "string" ? undefined : company.market ?? undefined,
    sector: typeof company === "string" ? undefined : company.sector ?? undefined,
    business: typeof company === "string" ? undefined : company.business ?? undefined,
    viewedAt: new Date().toISOString(),
  };
  const previous = getRecentCompanies();
  const withoutDuplicate = previous.filter(
    (item) => !isSameRecentCompany(item, nextCompany)
  );

  const next = [nextCompany, ...withoutDuplicate].slice(0, MAX_RECENT_COMPANIES);

  window.localStorage.setItem(RECENT_COMPANIES_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("recentCompaniesUpdated"));

  return next;
}

export function removeRecentCompany(companyName: string) {
  if (typeof window === "undefined") {
    return [];
  }

  const name = normalizeRecentCompanyKey(companyName);
  const next = getRecentCompanies().filter(
    (item) => normalizeRecentCompanyKey(item.name) !== name
  );

  window.localStorage.setItem(RECENT_COMPANIES_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("recentCompaniesUpdated"));

  return next;
}

export function mergeRecentCompanies(
  localCompanies: RecentCompany[],
  serverCompanies: RecentCompany[]
) {
  const merged = [...serverCompanies, ...localCompanies].reduce<RecentCompany[]>(
    (acc, item) => {
      const normalized = normalizeRecentCompanyItem(item);

      if (!normalized) {
        return acc;
      }

      const exists = acc.some((company) =>
        isSameRecentCompany(company, normalized)
      );

      if (exists) {
        return acc;
      }

      acc.push(normalized);
      return acc;
    },
    []
  );

  return merged
    .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
    .slice(0, MAX_RECENT_COMPANIES);
}

export function getRecentCompaniesStorageKey() {
  return RECENT_COMPANIES_KEY;
}

export function clearRecentCompanies() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(RECENT_COMPANIES_KEY);
  window.dispatchEvent(new Event("recentCompaniesUpdated"));
}

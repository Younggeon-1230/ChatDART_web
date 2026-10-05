import {
  analyzeExperimentalCashFlowInsight,
  EXPERIMENTAL_CASH_FLOW_MIN_NET_INCOME,
  EXPERIMENTAL_CASH_FLOW_TO_NET_INCOME_RATIO_THRESHOLD,
  type FinancialInsightInput,
} from "../src/lib/financialInsights";

const API_BASE_URL = process.env.CHATDART_API_BASE_URL?.replace(/\/$/, "");

if (!API_BASE_URL) {
  throw new Error("CHATDART_API_BASE_URL is required.");
}
const THRESHOLDS = [0.3, 0.4, 0.5, 0.6] as const;

type CollectedCompany = {
  stock_code: string;
  company_name: string;
};

type SummaryDetailResponse = {
  collection_status: string;
  is_financial_sector?: boolean;
  summary: {
    stock_code: string;
    company_name: string;
    is_financial_sector?: boolean;
  };
  trend?: {
    history?: FinancialInsightInput[];
  };
};

type AnalysisRow = {
  stockCode: string;
  company: string;
  year: string | number;
  isFinancialSector: boolean;
  netIncome: number | null;
  operatingCashFlow: number | null;
  ratio: number | null;
  observation: "zero-operating-cash-flow" | null;
  currentMatched: boolean;
  note: string;
};

async function requestJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function getAccessToken(): Promise<string> {
  const storedToken = process.env.CHATDART_ACCESS_TOKEN?.trim();
  if (storedToken) return storedToken;

  const email = process.env.CHATDART_EMAIL?.trim();
  const password = process.env.CHATDART_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set CHATDART_ACCESS_TOKEN or both CHATDART_EMAIL and CHATDART_PASSWORD."
    );
  }

  const auth = await requestJson<{ access_token: string }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return auth.access_token;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getRowNote(row: Omit<AnalysisRow, "note">): string {
  if (row.isFinancialSector) return "금융업 제외";
  if (!isFiniteNumber(row.netIncome)) return "순이익 없음";
  if (row.netIncome < EXPERIMENTAL_CASH_FLOW_MIN_NET_INCOME) {
    return "순이익 100억원 미만";
  }
  if (!isFiniteNumber(row.operatingCashFlow)) return "OCF 없음";
  if (row.operatingCashFlow < 0) return "OCF 음수";
  if (row.observation === "zero-operating-cash-flow") return "OCF 0 관찰";
  return row.currentMatched ? "현재 조건 충족" : "현재 조건 미충족";
}

function matchesThreshold(row: AnalysisRow, threshold: number): boolean {
  return (
    !row.isFinancialSector &&
    isFiniteNumber(row.netIncome) &&
    row.netIncome >= EXPERIMENTAL_CASH_FLOW_MIN_NET_INCOME &&
    isFiniteNumber(row.operatingCashFlow) &&
    row.operatingCashFlow > 0 &&
    isFiniteNumber(row.ratio) &&
    row.ratio < threshold
  );
}

const accessToken = await getAccessToken();
const headers = { Authorization: `Bearer ${accessToken}` };
const companies = await requestJson<CollectedCompany[]>(
  "/finance/companies?limit=200&offset=0",
  { headers }
);

if (companies.length !== 15) {
  throw new Error(
    `Expected the production demo set to contain 15 companies, received ${companies.length}.`
  );
}

const rows: AnalysisRow[] = [];

for (const company of companies) {
  const query = new URLSearchParams({
    keyword: company.stock_code,
    stockCode: company.stock_code,
    unit: "원",
  });
  const detail = await requestJson<SummaryDetailResponse>(
    `/finance/summary/detail?${query.toString()}`,
    { headers }
  );
  if (detail.collection_status !== "completed") {
    throw new Error(
      `${company.stock_code} collection status is ${detail.collection_status}.`
    );
  }
  const isFinancialSector =
    detail.is_financial_sector ??
    detail.summary.is_financial_sector ??
    false;
  const history = (detail.trend?.history ?? []).map((item) => ({
    ...item,
    stock_code: detail.summary.stock_code || company.stock_code,
    company_name: detail.summary.company_name || company.company_name,
  }));
  if (history.length !== 5) {
    throw new Error(
      `${company.stock_code} expected 5 yearly rows, received ${history.length}.`
    );
  }
  const results = analyzeExperimentalCashFlowInsight(history, {
    isFinancialSector,
  });

  results.forEach((result) => {
    const rowWithoutNote = {
      stockCode: String(result.stockCode ?? company.stock_code),
      company: result.companyName ?? company.company_name,
      year: result.year,
      isFinancialSector,
      netIncome: result.netIncome,
      operatingCashFlow: result.operatingCashFlow,
      ratio: result.cashFlowToNetIncomeRatio,
      observation: result.observation,
      currentMatched: result.matched,
    };

    rows.push({ ...rowWithoutNote, note: getRowNote(rowWithoutNote) });
  });
}

const nonFinancialRows = rows.filter((row) => !row.isFinancialSector);
const currentMatches = rows.filter((row) => row.currentMatched);
const withoutMinimumMatches = nonFinancialRows.filter(
  (row) =>
    isFiniteNumber(row.netIncome) &&
    row.netIncome > 0 &&
    isFiniteNumber(row.operatingCashFlow) &&
    row.operatingCashFlow > 0 &&
    isFiniteNumber(row.ratio) &&
    row.ratio < EXPERIMENTAL_CASH_FLOW_TO_NET_INCOME_RATIO_THRESHOLD
);
const financialWouldMatch = rows.filter(
  (row) =>
    row.isFinancialSector &&
    isFiniteNumber(row.netIncome) &&
    row.netIncome >= EXPERIMENTAL_CASH_FLOW_MIN_NET_INCOME &&
    isFiniteNumber(row.operatingCashFlow) &&
    row.operatingCashFlow > 0 &&
    isFiniteNumber(row.ratio) &&
    row.ratio < EXPERIMENTAL_CASH_FLOW_TO_NET_INCOME_RATIO_THRESHOLD
);

const thresholdSummary = THRESHOLDS.map((threshold) => {
  const matches = rows.filter((row) => matchesThreshold(row, threshold));

  return {
    threshold,
    companyCount: new Set(matches.map((row) => row.stockCode)).size,
    yearCount: matches.length,
    matches: matches.map((row) => `${row.stockCode}:${row.year}`),
  };
});

const helperMismatchCount = rows.filter(
  (row) =>
    row.currentMatched !==
    matchesThreshold(
      row,
      EXPERIMENTAL_CASH_FLOW_TO_NET_INCOME_RATIO_THRESHOLD
    )
).length;

const report = {
      generatedAt: new Date().toISOString(),
      source: `${API_BASE_URL}/finance/companies and /finance/summary/detail`,
      companyCount: companies.length,
      companies,
      rowCount: rows.length,
      nonFinancialCompanyCount: new Set(
        nonFinancialRows.map((row) => row.stockCode)
      ).size,
      financialCompanyCount: new Set(
        rows
          .filter((row) => row.isFinancialSector)
          .map((row) => row.stockCode)
      ).size,
      current: {
        minimumNetIncome: EXPERIMENTAL_CASH_FLOW_MIN_NET_INCOME,
        ratioThreshold:
          EXPERIMENTAL_CASH_FLOW_TO_NET_INCOME_RATIO_THRESHOLD,
        companyCount: new Set(currentMatches.map((row) => row.stockCode)).size,
        yearCount: currentMatches.length,
      },
      minimumNetIncomeFilter: {
        matchesWithoutMinimum: withoutMinimumMatches.length,
        matchesWithMinimum: currentMatches.length,
        filteredOut: withoutMinimumMatches.length - currentMatches.length,
      },
      thresholdSummary,
      zeroOperatingCashFlow: nonFinancialRows.filter(
        (row) => row.observation === "zero-operating-cash-flow"
      ),
      negativeOperatingCashFlowCount: nonFinancialRows.filter(
        (row) =>
          isFiniteNumber(row.operatingCashFlow) && row.operatingCashFlow < 0
      ).length,
      financialWouldMatch,
      helperMismatchCount,
      currentMatches,
      rows,
};

if (process.argv.includes("--markdown-rows")) {
  console.log(
    "| 종목코드 | 기업 | 연도 | 순이익(원) | OCF(원) | OCF/순이익 | 현재 충족 | 비고 |"
  );
  console.log("|---|---|---:|---:|---:|---:|:---:|---|");
  rows
    .filter((row) => !row.isFinancialSector)
    .sort(
      (a, b) =>
        a.stockCode.localeCompare(b.stockCode) || Number(b.year) - Number(a.year)
    )
    .forEach((row) => {
      const ratio = isFiniteNumber(row.ratio) ? row.ratio.toFixed(4) : "-";
      console.log(
        `| ${row.stockCode} | ${row.company} | ${row.year} | ${row.netIncome ?? "-"} | ${row.operatingCashFlow ?? "-"} | ${ratio} | ${row.currentMatched ? "예" : "아니오"} | ${row.note} |`
      );
    });
} else {
  console.log(JSON.stringify(report, null, 2));
}

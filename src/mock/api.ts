import type {
  CollectResponseApi,
  CompanySearchItemApi,
  CompanySummaryApiResponse,
  InsightInterpretationResponseApi,
} from "@/types/api";

export const mockKnownCompaniesApi: CompanySearchItemApi[] = [
  { name: "삼성전자", code: "005930", stockCode: "005930", market: "KOSPI" },
  { name: "SK하이닉스", code: "000660", stockCode: "000660", market: "KOSPI" },
  { name: "NAVER", code: "035420", stockCode: "035420", market: "KOSPI" },
  { name: "카카오", code: "035720", stockCode: "035720", market: "KOSPI" },
  { name: "현대차", code: "005380", stockCode: "005380", market: "KOSPI" },
  { name: "삼성SDI", code: "006400", stockCode: "006400", market: "KOSPI" },
  {
    name: "삼성바이오로직스",
    code: "207940",
    stockCode: "207940",
    market: "KOSPI",
  },
];

export const mockSearchResultsApi: CompanySearchItemApi[] =
  mockKnownCompaniesApi;

export const mockCollectStartedApi: CollectResponseApi = {
  status: "started",
  resolved_code: "005930",
};

export const mockLowOperatingCashFlowInterpretationResponse: InsightInterpretationResponseApi =
  {
    stock_code: "035420",
    interpretation_available: true,
    interpretation: {
      headline: "영업활동현금흐름을 추가로 확인해 보세요.",
      positive: null,
      caution:
        "단년도 현상인지 다음 기간의 흐름과 함께 확인할 필요가 있습니다.",
      check_items: ["영업활동현금흐름"],
    },
  };

export const mockSummaryApiResponse: CompanySummaryApiResponse = {
  company_name: "삼성전자",
  stock_code: "005930",
  fiscal_year: 2024,
  is_financial_sector: false,
  industry_type: "general",
  revenue_label: "매출액",
  operating_profit_label: "영업이익",
  summary_text:
    "[삼성전자 2024년 결산] 매출액 300,870,000,000,000원, 판관비 78,144,000,000,000원, 영업이익 32,726,000,000,000원\n최근 매출은 전년 대비 증가했습니다.\n영업이익률도 개선 흐름을 보입니다.",
  growth_status: "양호",
  stability_status: "우수",
  profitability_status: "개선",
  history: [
    {
      fiscal_year: 2024,
      revenue: 300870000000000,
      cost_of_sales: 190000000000000,
      gross_profit: 110870000000000,
      sga: 78144000000000,
      operating_profit: 32726000000000,
      other_income: null,
      other_expense: null,
      finance_income: null,
      finance_cost: null,
      income_before_tax: null,
      income_tax_expense: null,
      net_income: 34459000000000,
      operating_cash_flow: null,
      total_assets: 514086000000000,
      total_liabilities: 143027000000000,
      equity: 371059000000000,
      cash: 81000000000000,
      source_report: "삼성전자 2024년 사업보고서",
    },
    {
      fiscal_year: 2023,
      revenue: 258935000000000,
      cost_of_sales: 180000000000000,
      gross_profit: 78935000000000,
      sga: 72369000000000,
      operating_profit: 6566000000000,
      other_income: null,
      other_expense: null,
      finance_income: null,
      finance_cost: null,
      income_before_tax: null,
      income_tax_expense: null,
      net_income: 15487000000000,
      operating_cash_flow: null,
      total_assets: 455905000000000,
      total_liabilities: 117938000000000,
      equity: 337967000000000,
      cash: 69000000000000,
      source_report: "삼성전자 2023년 사업보고서",
    },
  ],
};

export const mockFinancialSummaryApiResponse: CompanySummaryApiResponse = {
  company_name: "삼성화재",
  stock_code: "000810",
  fiscal_year: 2024,
  is_financial_sector: true,
  industry_type: "insurance",
  revenue_label: null,
  operating_profit_label: null,
  summary_text:
    "[삼성화재 2024년 결산] 금융업 특성상 총자산·부채·자기자본·당기순이익·현금 중심으로 제공됩니다.",
  growth_status: "양호",
  stability_status: "우수",
  profitability_status: "유지",
  history: [
    {
      fiscal_year: 2024,
      revenue: null,
      cost_of_sales: 0,
      gross_profit: 0,
      sga: 0,
      operating_profit: null,
      other_income: null,
      other_expense: null,
      finance_income: null,
      finance_cost: null,
      income_before_tax: null,
      income_tax_expense: null,
      net_income: 1450000000000,
      operating_cash_flow: null,
      total_assets: 520000000000000,
      total_liabilities: 470000000000000,
      equity: 50000000000000,
      cash: 22000000000000,
      source_report:
        "삼성화재 2024년 사업보고서 [금융업: 총자산·부채·자기자본·당기순이익·현금만 제공]",
    },
  ],
};

export type Nullable<T> = T | null;

export type IndustryType =
  | "general"
  | "bank"
  | "insurance"
  | "securities"
  | "financial";

export type FinancialSectorMeta = {
  is_financial_sector?: boolean;
  industry_type?: Nullable<IndustryType>;
  revenue_label?: Nullable<string>;
  operating_profit_label?: Nullable<string>;
};

export type ApiDataSourceMeta = {
  __dataSource?: "api" | "api-partial" | "mock";
};

export type ApiErrorResponse = {
  detail?:
    | string
    | Array<{
        loc?: Array<string | number>;
        msg?: string;
        message?: string;
        type?: string;
      }>;
  message?: string;
  error?: string;
  errors?: Array<{
    message?: string;
    field?: string;
  }>;
};

export type MembershipPlanApi = "free" | "pro" | (string & {});

export type MembershipPlanItemApi = {
  id?: string | number;
  plan?: Nullable<MembershipPlanApi>;
  name?: Nullable<string>;
  tier?: Nullable<MembershipPlanApi>;
  price?: Nullable<number | string>;
  price_krw?: Nullable<number | string>;
  duration_days?: Nullable<number>;
  watchlist_limit?: Nullable<number>;
  features?: Nullable<string[]>;
  description?: Nullable<string>;
  [key: string]: unknown;
};

export type MembershipPlansResponseApi = {
  items?: MembershipPlanItemApi[];
  plans?: MembershipPlanItemApi[];
  [key: string]: unknown;
};

export type LoginRequestApi = {
  email: string;
  password: string;
};

export type SignupRequestApi = {
  email: string;
  password: string;
  nickname?: Nullable<string>;
  terms_agreed: boolean;
};

export type AuthTokenResponseApi = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer" | "Bearer" | (string & {});
  [key: string]: unknown;
};

export type RefreshTokenRequestApi = {
  refresh_token: string;
};

export type UserMembershipApi = {
  plan?: MembershipPlanApi;
  plan_info?: Nullable<MembershipPlanItemApi>;
  membership_tier?: MembershipPlanApi;
  tier?: MembershipPlanApi;
  status?: "active" | "inactive" | "expired" | "pending" | (string & {});
  started_at?: Nullable<string>;
  expires_at?: Nullable<string>;
  days_until_expiry?: Nullable<number>;
  watchlist_limit: number;
  watchlist_count: number;
  [key: string]: unknown;
};

export type RegisterResponseApi = {
  id: number | string;
  email: string;
  nickname?: Nullable<string>;
  membership_tier: MembershipPlanApi;
  is_active: boolean;
  is_admin: boolean;
  is_verified: boolean;
  terms_agreed_at?: Nullable<string>;
  created_at?: Nullable<string>;
  email_sent?: boolean;
  [key: string]: unknown;
};

export type CompanySearchItemApi = {
  name?: string;
  code?: string;
  corpName?: string;
  companyName?: string;
  displayName?: string;
  matchedName?: string;
  corpCode?: Nullable<string>;
  stockCode?: Nullable<string>;
  market?: Nullable<string>;
  sector?: Nullable<string>;
  industry?: Nullable<string>;
  business?: Nullable<string>;
  is_collected?: boolean;
};

export type CollectResponseStatus = "started" | "already_processing";

export type CollectResponseApi = ApiDataSourceMeta & {
  status: CollectResponseStatus;
  resolved_code: string;
  message?: Nullable<string>;
};

export type CollectStatus =
  | "none"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type CollectionStatusResponseApi = ApiDataSourceMeta & {
  status: CollectStatus;
  resolved_code?: Nullable<string>;
  message?: Nullable<string>;
  started_at?: Nullable<string>;
  updated_at?: Nullable<string>;
  collection_updated_at?: Nullable<string>;
};

export type BatchCollectStatus = CollectStatus | "error";

export type YearlyDataApi = {
  fiscal_year: number;
  revenue: Nullable<number>;
  cost_of_sales: Nullable<number>;
  gross_profit: Nullable<number>;
  sga: Nullable<number>;
  operating_profit: Nullable<number>;
  other_income: Nullable<number>;
  other_expense: Nullable<number>;
  finance_income: Nullable<number>;
  finance_cost: Nullable<number>;
  income_before_tax: Nullable<number>;
  income_tax_expense: Nullable<number>;
  net_income: Nullable<number>;
  operating_cash_flow: Nullable<number>;
  operating_margin?: Nullable<number>;
  net_margin?: Nullable<number>;
  revenue_growth_rate?: Nullable<number>;
  total_assets: Nullable<number>;
  total_liabilities: Nullable<number>;
  equity: Nullable<number>;
  cash: Nullable<number>;
  source_report?: Nullable<string>;
};

export type CompanySummaryStatus = {
  growth_status: string;
  stability_status: string;
  profitability_status: string;
};

export type SectorAverageApi = {
  revenue_growth_rate?: Nullable<number>;
  operating_margin?: Nullable<number>;
  net_margin?: Nullable<number>;
  roe?: Nullable<number>;
  roa?: Nullable<number>;
  debt_ratio?: Nullable<number>;
  sample_size?: Nullable<number>;
  [key: string]: unknown;
};

export type CompanySummaryApiResponse = ApiDataSourceMeta &
  FinancialSectorMeta &
  CompanySummaryStatus & {
  company_name: string;
  stock_code: string;
  fiscal_year: number;
  sector?: Nullable<string>;
  business?: Nullable<string>;
  mainBusiness?: Nullable<string>;
  businessSummary?: Nullable<string>;
  summary_text: string;
  metrics?: Nullable<Record<string, unknown>>;
  warning_flags?: unknown[];
  sector_avg?: Nullable<SectorAverageApi>;
  sector_rank?: unknown;
  history: YearlyDataApi[];
};

export type TrendApiResponse = ApiDataSourceMeta & {
  company_name?: string;
  stock_code?: string;
  fiscal_year?: number;
  history?: YearlyDataApi[];
  trend?: YearlyDataApi[];
  [key: string]: unknown;
};

export type SummaryDetailApiResponse = ApiDataSourceMeta & FinancialSectorMeta & {
  summary: CompanySummaryApiResponse;
  trend: TrendApiResponse;
  collection_status: CollectStatus;
  message?: Nullable<string>;
  collection_updated_at?: Nullable<string>;
};

export type WatchlistItemApi = {
  id?: number;
  stock_code?: Nullable<string>;
  company_name?: Nullable<string>;
  sector?: Nullable<string>;
  memo?: Nullable<string>;
  added_at?: Nullable<string>;
  created_at?: Nullable<string>;
  updated_at?: Nullable<string>;
  [key: string]: unknown;
};

export type WatchlistCreateRequestApi = {
  stock_code: string;
  company_name: string;
  memo?: Nullable<string>;
};

export type WatchlistPostResponseApi = {
  item: WatchlistItemApi;
  watchlist_count?: number;
  watchlist_limit?: number;
};

export type WatchlistSummaryItemApi = WatchlistItemApi & {
  summary?: Nullable<CompanySummaryApiResponse>;
  latest_summary?: Nullable<CompanySummaryApiResponse>;
  collection_status?: CollectStatus;
  collection_updated_at?: Nullable<string>;
};

export type WatchlistSummariesResponseApi = {
  items: WatchlistSummaryItemApi[];
  watchlist_count?: number;
  watchlist_limit?: number;
  updated_at?: Nullable<string>;
};

export type WatchlistUpdateRequestApi = {
  memo?: Nullable<string>;
};

export type WatchlistMutationResponseApi =
  | WatchlistItemApi
  | WatchlistPostResponseApi;

export type DashboardUsageApi = {
  membership?: MembershipPlanApi | UserMembershipApi;
  watchlist_count?: number;
  watchlist_limit?: number;
  recent_search_count?: number;
  [key: string]: unknown;
};

export type DashboardRecentSearchItemApi = Partial<CompanySearchItemApi> & {
  keyword?: Nullable<string>;
  company_name?: Nullable<string>;
  stock_code?: Nullable<string>;
  searched_at?: Nullable<string>;
  viewed_at?: Nullable<string>;
  count?: Nullable<number>;
  [key: string]: unknown;
};

export type DashboardResponseApi = {
  membership_tier?: MembershipPlanApi;
  watchlist_count?: number;
  watchlist_limit?: number;
  watchlist_preview?: WatchlistSummaryItemApi[];
  popular_week?: PopularCompanyItemApi[];
  recent_searches?: DashboardRecentSearchItemApi[];
  usage?: DashboardUsageApi;
  [key: string]: unknown;
};

export type CompareShareSaveResponseApi = {
  share_id: string;
  expires_at: string;
};

export type CompareShareResponseApi = ApiDataSourceMeta & {
  share_id?: string;
  expires_at?: Nullable<string>;
  keywords?: unknown[];
  companies?: unknown[];
  leftCompany?: unknown;
  rightCompany?: unknown;
  [key: string]: unknown;
};

export type SimilarCompanyApi = Partial<CompanySummaryStatus> & {
  stock_code?: Nullable<string>;
  company_name?: Nullable<string>;
  corp_name?: Nullable<string>;
  corpName?: Nullable<string>;
  companyName?: Nullable<string>;
  name?: Nullable<string>;
  sector?: Nullable<string>;
  fiscal_year?: Nullable<number | string>;
  revenue?: Nullable<number | string>;
  operating_profit?: Nullable<number | string>;
  operating_margin?: Nullable<number | string>;
  match_count?: Nullable<number | string>;
  similarity_reason?: Nullable<string>;
  reason?: Nullable<string>;
  reasons?: Nullable<string[] | string>;
  [key: string]: unknown;
};

export type SimilarCompaniesResponseApi =
  | SimilarCompanyApi[]
  | {
      items?: SimilarCompanyApi[];
      similar_companies?: SimilarCompanyApi[];
      results?: SimilarCompanyApi[];
      [key: string]: unknown;
    };

export type RecommendedCompanyApi = Partial<CompanySummaryStatus> & {
  stock_code?: Nullable<string>;
  company_name?: Nullable<string>;
  sector?: Nullable<string>;
  fiscal_year?: Nullable<number | string>;
  revenue?: Nullable<number>;
  operating_profit?: Nullable<number>;
  operating_margin?: Nullable<number>;
  healthy_count?: Nullable<number>;
  [key: string]: unknown;
};

export type AiAnalysisResponse = {
  stock_code?: Nullable<string>;
  company_name?: Nullable<string>;
  // Next-year prediction in KRW. The metric label may vary by company type.
  prediction?: Nullable<number | string>;
  prediction_label?: Nullable<string>;
  prediction_display_text?: Nullable<string>;
  prediction_sentence?: Nullable<string>;
  summary?: Nullable<string>;
  summary_available?: boolean;
  is_financial?: boolean;
  [key: string]: unknown;
};

export type InsightInterpretationEvidenceApi = {
  label: string;
  currentValue: number;
  previousValue?: number | null;
  changeRate?: number | null;
};

export type InsightInterpretationFlagApi = {
  id: string;
  year: string | number;
  title: string;
  evidence: InsightInterpretationEvidenceApi[];
};

export type InsightInterpretationRequestApi = {
  stock_code: string;
  company: string;
  latest_year: string | number;
  warning_flags: InsightInterpretationFlagApi[];
  positive_flags: InsightInterpretationFlagApi[];
};

export type InsightInterpretationApi = {
  headline: string;
  positive: string | null;
  caution: string | null;
  check_items: string[];
};

export type InsightInterpretationResponseApi = {
  stock_code: string;
  interpretation: InsightInterpretationApi | null;
  interpretation_available: boolean;
};

export type FinancialDisclosureCategory =
  | "periodic"
  | "performance"
  | "major"
  | "other";

export type FinancialDisclosureApi = {
  title: string;
  date: string;
  submitter: string;
  viewer_url: string;
  category: FinancialDisclosureCategory;
};

export type FinancialDisclosuresResponseApi = {
  stock_code: string;
  disclosures: FinancialDisclosureApi[];
};

/**
 * 발표용 확장 포인트:
 * 실제 우선순위는 낮지만, 추후 인기 검색 기업 기능을 붙일 때 사용할 타입 초안
 */
export type PopularCompaniesWindow = "realtime" | "daily" | "weekly";

export type PopularCompanyItemApi = {
  keyword?: Nullable<string>;
  company_name?: Nullable<string>;
  stock_code?: Nullable<string>;
  count?: Nullable<number>;
  rank?: number;
  updated_at?: Nullable<string>;
  [key: string]: unknown;
};

export type PopularCompaniesResponseApi = {
  items: PopularCompanyItemApi[];
  window: PopularCompaniesWindow;
  updated_at?: Nullable<string>;
  generated_at?: Nullable<string>;
};

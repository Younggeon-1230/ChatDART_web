export type StatusLevel = "good" | "normal" | "warning";

export type SummaryMetric = {
  label: string;
  description: string;
  status?: StatusLevel;
  value?: string;
};

export type CompanySummaryResponse = {
  companyId: string;
  companyName: string;
  latestYear?: string;
  market?: string;
  industry?: string;
  growth: SummaryMetric;
  stability: SummaryMetric;
  profitability: SummaryMetric;
  summaryLines: string[];
  events?: FinancialEvent[];
  sourceReport?: string;
  isFinancialSector?: boolean;
  collectedAt?: string;
};

export type ChartData = {
  title: string;
  labels: string[];
  values: number[];
  unit?: string;
  colorKey?: string;
};

export type MultiSeriesChartData = {
  title: string;
  labels: string[];
  series: {
    name: string;
    values: number[];
  }[];
  unit?: string;
};

export type AccountDescription = {
  name: string;
  description: string;
};

export type FinancialEvent = {
  title: string;
  message: string;
  level: StatusLevel;
};

export type CompanyDetailResponse = {
  companyId: string;
  companyName: string;
  latestYear?: string;
  overview?: string;
  sectionTitle: string;
  charts: ChartData[];
  multiSeriesCharts?: MultiSeriesChartData[];
  accountDescriptions: AccountDescription[];
  events?: FinancialEvent[];
  sourceReport?: string;
  isFinancialSector?: boolean;
};

import type { CompanySummaryApiResponse, YearlyDataApi } from "@/types/api";
import {
  formatCurrency,
  formatPercent as formatPercentValue,
  formatRatio,
} from "@/lib/format";
import { buildThreeLineFinancialSummary } from "@/lib/financialNarratives";
import {
  calculateFinancialGrowth,
  calculateFinancialRatio,
  resolveFinancialSector,
  sortFinancialHistory,
} from "@/lib/financialNormalize";
import type {
  CompanyDetailResponse,
  CompanySummaryResponse,
  FinancialEvent,
  StatusLevel,
} from "@/types/financial";

function getStatusLevel(label: string): StatusLevel {
  if (label === "양호" || label === "우수" || label === "개선") {
    return "good";
  }

  if (label === "부진" || label === "주의") {
    return "warning";
  }

  return "normal";
}

function formatKrwCompact(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";

  const abs = Math.abs(value);

  if (abs >= 1_0000_0000_0000) {
    return `${formatRatio(value / 1_0000_0000_0000, 1)}조 원`;
  }

  if (abs >= 1_0000_0000) {
    return `${formatRatio(value / 1_0000_0000, 1)}억 원`;
  }

  if (abs >= 1_0000) {
    return `${formatRatio(value / 1_0000, 1)}만 원`;
  }

  return formatCurrency(value);
}

function formatPercent(value: number): string {
  return formatPercentValue(value, 1);
}

function calculateMargin(
  numerator?: number | null,
  denominator?: number | null
): number | null {
  return calculateFinancialRatio(numerator, denominator, {
    allowNegativeNumerator: true,
  });
}

function calculateGrowthRate(
  current?: number | null,
  previous?: number | null
): number | null {
  return calculateFinancialGrowth(current, previous, { allowNegative: true });
}

function getGrossProfit(item: YearlyDataApi): number | null {
  if (item.gross_profit !== null && item.gross_profit !== undefined) {
    return item.gross_profit;
  }

  if (
    item.revenue !== null &&
    item.revenue !== undefined &&
    item.cost_of_sales !== null &&
    item.cost_of_sales !== undefined
  ) {
    return item.revenue - item.cost_of_sales;
  }

  return null;
}

function normalizeSummaryText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/\s+/g, " ").trim());
}

function buildFallbackSummaryLines(api: CompanySummaryApiResponse): string[] {
  return buildThreeLineFinancialSummary(api.company_name, api.history, {
    growth: api.growth_status,
    stability: api.stability_status,
    profitability: api.profitability_status,
  });
}

function buildSummaryLines(api: CompanySummaryApiResponse): string[] {
  const history = sortFinancialHistory(api.history);
  const latest = history.at(-1);
  const rawLines = normalizeSummaryText(api.summary_text);
  const generatedLines = buildFallbackSummaryLines(api);

  if (!rawLines.length) {
    return generatedLines;
  }

  const replacements: Array<[string, string]> = [];

  if (latest?.revenue !== null && latest?.revenue !== undefined) {
    replacements.push([
      formatCurrency(latest.revenue),
      formatKrwCompact(latest.revenue),
    ]);
  }

  if (
    latest?.operating_profit !== null &&
    latest?.operating_profit !== undefined
  ) {
    replacements.push([
      formatCurrency(latest.operating_profit),
      formatKrwCompact(latest.operating_profit),
    ]);
  }

  if (latest?.sga !== null && latest?.sga !== undefined && latest.sga > 0) {
    replacements.push([
      formatCurrency(latest.sga),
      formatKrwCompact(latest.sga),
    ]);
  }

  const normalized = rawLines.map((line) => {
    let next = line;

    replacements.forEach(([before, after]) => {
      next = next.replace(new RegExp(before, "g"), after);
    });

    next = next.replace(/\s+/g, " ").trim();
    return next;
  });

  return [...generatedLines, ...normalized].slice(0, 3);
}

function buildEvents(api: CompanySummaryApiResponse): FinancialEvent[] {
  const history = sortFinancialHistory(api.history);
  const latest = history.at(-1);
  const previous = history.at(-2);
  if (!latest) return [];

  const events: FinancialEvent[] = [];
  const financial = resolveFinancialSector(api, latest.source_report);
  const revenueGrowth = calculateGrowthRate(latest.revenue, previous?.revenue);
  const operatingMargin = calculateMargin(
    latest.operating_profit,
    latest.revenue
  );

  if (financial) {
    events.push({
      title: "금융업 종목 안내",
      message:
        "이 종목은 금융업으로 일부 지표가 일반 제조업과 다르게 해석될 수 있습니다.",
      level: "normal",
    });
  }

  if (api.growth_status === "양호" || api.growth_status === "우수") {
    events.push({
      title: "성장 흐름 양호",
      message:
        revenueGrowth !== null
          ? `전년 대비 매출 성장률은 ${formatPercent(revenueGrowth)} 수준으로 파악됩니다.`
          : "최근 매출 흐름과 외형 성장 측면에서 긍정적인 신호가 확인되었습니다.",
      level: "good",
    });
  } else if (api.growth_status === "부진") {
    events.push({
      title: "성장 흐름 점검 필요",
      message:
        "최근 외형 성장세가 둔화되었을 가능성이 있어 추가 확인이 필요합니다.",
      level: "warning",
    });
  }

  if (api.stability_status === "우수") {
    events.push({
      title: "재무 안정성 우수",
      message:
        "자산과 부채 구조 측면에서 비교적 안정적인 재무 상태로 해석됩니다.",
      level: "good",
    });
  } else if (api.stability_status === "주의") {
    events.push({
      title: "안정성 점검 필요",
      message:
        "부채 부담이나 재무 구조를 추가로 확인할 필요가 있습니다.",
      level: "warning",
    });
  }

  if (api.profitability_status === "개선" || api.profitability_status === "우수") {
    events.push({
      title: "수익성 개선",
      message:
        operatingMargin !== null
          ? `최근 영업이익률은 ${formatPercent(operatingMargin)} 수준으로 확인됩니다.`
          : "본업 수익성과 이익 창출력 측면에서 개선 흐름이 확인되었습니다.",
      level: "good",
    });
  } else if (api.profitability_status === "부진") {
    events.push({
      title: "수익성 보완 필요",
      message: "이익률과 수익 구조를 함께 살펴볼 필요가 있습니다.",
      level: "warning",
    });
  }

  return events;
}

export function transformSummaryApiToUi(
  api: CompanySummaryApiResponse
): CompanySummaryResponse {
  const history = sortFinancialHistory(api.history);
  const latest = history.at(-1);
  const previous = history.at(-2);
  const sourceReport = latest?.source_report ?? undefined;
  const financial = resolveFinancialSector(api, sourceReport);

  return {
    companyId: api.stock_code,
    companyName: api.company_name,
    latestYear: String(api.fiscal_year),

    growth: {
      label: api.growth_status,
      description:
        previous?.revenue !== null && previous?.revenue !== undefined
          ? "최근 외형 성장 흐름과 전년 대비 매출 변화 기준 평가"
          : "최근 외형 성장 흐름 기준 평가",
      status: getStatusLevel(api.growth_status),
      value: api.growth_status,
    },

    stability: {
      label: api.stability_status,
      description: "재무 구조와 부채 부담 기준 평가",
      status: getStatusLevel(api.stability_status),
      value: api.stability_status,
    },

    profitability: {
      label: api.profitability_status,
      description: financial
        ? "금융업 특성상 일부 수익성 지표 해석이 제한됩니다."
        : "이익 창출력과 수익성 흐름 기준 평가",
      status: getStatusLevel(api.profitability_status),
      value: api.profitability_status,
    },

    summaryLines: buildSummaryLines(api),
    events: buildEvents(api),
    sourceReport,
    isFinancialSector: financial,
  };
}

export function transformSummaryApiToDetailUi(
  api: CompanySummaryApiResponse
): CompanyDetailResponse {
  const sortedHistory = sortFinancialHistory(api.history);

  const latest = sortedHistory.at(-1);
  const previous = sortedHistory.at(-2);
  const sourceReport = latest?.source_report ?? undefined;
  const financial = resolveFinancialSector(api, sourceReport);

  const labels = sortedHistory.map((item) => String(item.fiscal_year));

  return {
    companyId: api.stock_code,
    companyName: api.company_name,
    latestYear: String(api.fiscal_year),
    overview: buildSummaryLines(api).join(" "),
    sectionTitle: "상세 재무 분석",

    charts: [
      {
        title: "매출",
        labels,
        values: sortedHistory.map((item) => item.revenue ?? 0),
        unit: "원",
      },
      {
        title: "매출총이익",
        labels,
        values: sortedHistory.map((item) => getGrossProfit(item) ?? 0),
        unit: "원",
      },
      {
        title: "영업이익",
        labels,
        values: sortedHistory.map((item) => item.operating_profit ?? 0),
        unit: "원",
      },
      {
        title: "당기순이익",
        labels,
        values: sortedHistory.map((item) => item.net_income ?? 0),
        unit: "원",
      },
      {
        title: "현금",
        labels,
        values: sortedHistory.map((item) => item.cash ?? 0),
        unit: "원",
      },
    ],

    multiSeriesCharts: [
      {
        title: "손익 구조",
        labels,
        series: [
          {
            name: "매출",
            values: sortedHistory.map((item) => item.revenue ?? 0),
          },
          {
            name: "매출원가",
            values: sortedHistory.map((item) => item.cost_of_sales ?? 0),
          },
          {
            name: "매출총이익",
            values: sortedHistory.map((item) => getGrossProfit(item) ?? 0),
          },
          {
            name: "판관비",
            values: sortedHistory.map((item) => item.sga ?? 0),
          },
          {
            name: "영업이익",
            values: sortedHistory.map((item) => item.operating_profit ?? 0),
          },
          {
            name: "당기순이익",
            values: sortedHistory.map((item) => item.net_income ?? 0),
          },
        ],
        unit: "원",
      },
      {
        title: "재무상태 구조",
        labels,
        series: [
          {
            name: "총자산",
            values: sortedHistory.map((item) => item.total_assets ?? 0),
          },
          {
            name: "총부채",
            values: sortedHistory.map((item) => item.total_liabilities ?? 0),
          },
          {
            name: "자기자본",
            values: sortedHistory.map((item) => item.equity ?? 0),
          },
          {
            name: "현금",
            values: sortedHistory.map((item) => item.cash ?? 0),
          },
        ],
        unit: "원",
      },
    ],

    accountDescriptions: [
      {
        name: "매출",
        description: financial
          ? "금융업 종목은 매출 개념이 일반 기업과 달라 해석에 주의가 필요합니다."
          : "기업의 외형 성장과 본업 규모를 보여주는 대표 지표입니다.",
      },
      {
        name: "매출원가",
        description:
          "제품이나 서비스를 제공하기 위해 직접 들어간 원가로, 매출총이익에 직접 영향을 줍니다.",
      },
      {
        name: "매출총이익",
        description:
          "매출에서 매출원가를 뺀 값으로, 본업의 기본 수익성을 보여줍니다.",
      },
      {
        name: "판관비",
        description:
          "판매비와 관리비를 의미하며, 영업이익에 영향을 주는 핵심 비용 항목입니다.",
      },
      {
        name: "영업이익",
        description: financial
          ? "금융업 종목은 이 지표가 제공되지 않습니다."
          : "본업에서 벌어들인 이익으로 수익성을 판단할 때 중요합니다.",
      },
      {
        name: "당기순이익",
        description:
          "최종적으로 남은 이익으로 전체 실적 판단에 도움이 됩니다.",
      },
      {
        name: "총자산",
        description: "기업 규모와 자산 기반을 보여주는 지표입니다.",
      },
      {
        name: "총부채",
        description:
          "부채 부담과 재무 안정성을 판단할 때 참고할 수 있습니다.",
      },
      {
        name: "자기자본",
        description:
          "순자산 개념으로 재무 구조를 이해하는 데 중요합니다.",
      },
      {
        name: "현금",
        description:
          "유동성과 단기 대응 여력을 판단할 때 참고할 수 있습니다.",
      },
      {
        name: "전년 대비 매출 성장률",
        description:
          previous?.revenue !== null && previous?.revenue !== undefined
            ? (() => {
                const growth = calculateGrowthRate(
                  latest?.revenue,
                  previous?.revenue
                );
                return growth !== null
                  ? `최근 기준 전년 대비 매출 성장률은 ${formatPercent(growth)} 수준입니다.`
                  : "성장률 계산을 위한 직전 연도 데이터가 충분하지 않습니다.";
              })()
            : "성장률 계산을 위한 직전 연도 데이터가 충분하지 않습니다.",
      },
      {
        name: "영업이익률",
        description: (() => {
          const margin = calculateMargin(
            latest?.operating_profit,
            latest?.revenue
          );
          return margin !== null
            ? `최근 기준 영업이익률은 ${formatPercent(margin)} 수준입니다.`
            : "영업이익률 계산을 위한 데이터가 충분하지 않습니다.";
        })(),
      },
    ],

    events: buildEvents(api),
    sourceReport,
    isFinancialSector: financial,
  };
}

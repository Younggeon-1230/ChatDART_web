import { ArrowRight } from "lucide-react";
import { StatusState } from "@/components/common/StatusState";
import Box from "@/components/financial/Box";
import MultiLineChart from "@/components/financial/MultiLineChart";
import SectionLabel from "@/components/financial/SectionLabel";
import { cn } from "@/lib/classNames";
import { toNumberOrNull } from "@/lib/financialNormalize";
import type { NumericValue } from "@/lib/format";
import type { YearlyDataApi } from "@/types/api";

type PostOperatingProfitFlowProps = {
  history: YearlyDataApi[];
  isFinancialSector: boolean;
  valueFormatter: (value: NumericValue) => string;
};

type FlowMetricProps = {
  label: string;
  value: number | null;
  valueFormatter: (value: NumericValue) => string;
  tone?: "default" | "income" | "expense" | "total";
};

const CORE_FLOW_FIELDS = [
  "operating_profit",
  "income_before_tax",
  "net_income",
] as const satisfies ReadonlyArray<keyof YearlyDataApi>;

function getAmount(value: unknown) {
  return toNumberOrNull(value, { allowNegative: true });
}

function FlowArrow() {
  return (
    <div
      className="hidden items-center justify-center text-slate-300 lg:flex"
      aria-hidden="true"
    >
      <ArrowRight className="h-5 w-5" />
    </div>
  );
}

function FlowMetric({
  label,
  value,
  valueFormatter,
  tone = "default",
}: FlowMetricProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3",
        tone === "income" && "border-emerald-100 bg-emerald-50/60",
        tone === "expense" && "border-rose-100 bg-rose-50/60",
        tone === "total" && "border-sky-200 bg-sky-50/70",
        tone === "default" && "border-slate-200 bg-white"
      )}
    >
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd
        className={cn(
          "mt-1.5 break-words text-sm font-semibold",
          value !== null && value < 0 ? "text-rose-600" : "text-slate-900"
        )}
      >
        {valueFormatter(value)}
      </dd>
    </div>
  );
}

export default function PostOperatingProfitFlow({
  history,
  isFinancialSector,
  valueFormatter,
}: PostOperatingProfitFlowProps) {
  if (isFinancialSector) {
    return (
      <Box className="p-4 sm:p-6">
        <SectionLabel>영업이익 이후 손익 흐름</SectionLabel>
        <StatusState
          variant="empty"
          title="금융업 손익 구조 안내"
          description="금융업은 일반 기업과 손익 항목 구조가 달라 이 분석을 제공하지 않습니다."
          compact
          className="mt-5"
        />
      </Box>
    );
  }

  const rows = history.map((item) => ({
    year: String(item.fiscal_year),
    operatingProfit: getAmount(item.operating_profit),
    incomeBeforeTax: getAmount(item.income_before_tax),
    netIncome: getAmount(item.net_income),
  }));
  const latest = [...history]
    .reverse()
    .find((item) =>
      CORE_FLOW_FIELDS.some((field) => getAmount(item[field]) !== null)
    );
  const validValueCount = rows.reduce(
    (count, row) =>
      count +
      [row.operatingProfit, row.incomeBeforeTax, row.netIncome].filter(
        (value) => value !== null
      ).length,
    0
  );

  if (!latest || validValueCount === 0) {
    return (
      <Box className="p-4 sm:p-6">
        <SectionLabel>영업이익 이후 손익 흐름</SectionLabel>
        <StatusState
          variant="empty"
          title="영업이익 이후 손익 흐름을 표시할 데이터가 부족합니다."
          description="관련 손익 항목이 수집되면 연도별 흐름을 확인할 수 있습니다."
          compact
          className="mt-5"
        />
      </Box>
    );
  }

  const latestMetrics = {
    operatingProfit: getAmount(latest.operating_profit),
    otherIncome: getAmount(latest.other_income),
    otherExpense: getAmount(latest.other_expense),
    financeIncome: getAmount(latest.finance_income),
    financeCost: getAmount(latest.finance_cost),
    incomeBeforeTax: getAmount(latest.income_before_tax),
    incomeTaxExpense: getAmount(latest.income_tax_expense),
    netIncome: getAmount(latest.net_income),
  };

  return (
    <Box className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionLabel>영업이익 이후 손익 흐름</SectionLabel>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            영업이익이 영업외손익과 법인세를 거쳐 당기순이익으로 이어지는
            흐름을 실제 공시 금액으로 확인합니다.
          </p>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
          실제 손익 계정
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-400">
        누락된 세부 항목은 0으로 추정하지 않으며, 보고된 소계와 순이익을
        임의로 재계산하지 않습니다.
      </p>

      <div className="mt-5 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
        <SectionLabel>연도별 핵심 손익 단계</SectionLabel>
        <div className="mt-4">
          <MultiLineChart
            labels={rows.map((row) => row.year)}
            series={[
              {
                name: "영업이익",
                values: rows.map((row) => row.operatingProfit),
              },
              {
                name: "법인세차감전순이익",
                values: rows.map((row) => row.incomeBeforeTax),
              },
              {
                name: "당기순이익",
                values: rows.map((row) => row.netIncome),
              },
            ]}
          />
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>{latest.fiscal_year}년 세부 손익 흐름</SectionLabel>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(240px,1.35fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
          <dl>
            <FlowMetric
              label="영업이익"
              value={latestMetrics.operatingProfit}
              valueFormatter={valueFormatter}
              tone="total"
            />
          </dl>
          <FlowArrow />

          <dl className="grid grid-cols-2 gap-2">
            <FlowMetric
              label="(+) 기타수익"
              value={latestMetrics.otherIncome}
              valueFormatter={valueFormatter}
              tone="income"
            />
            <FlowMetric
              label="(-) 기타비용"
              value={latestMetrics.otherExpense}
              valueFormatter={valueFormatter}
              tone="expense"
            />
            <FlowMetric
              label="(+) 금융수익"
              value={latestMetrics.financeIncome}
              valueFormatter={valueFormatter}
              tone="income"
            />
            <FlowMetric
              label="(-) 금융비용"
              value={latestMetrics.financeCost}
              valueFormatter={valueFormatter}
              tone="expense"
            />
          </dl>
          <FlowArrow />

          <dl>
            <FlowMetric
              label="법인세차감전순이익"
              value={latestMetrics.incomeBeforeTax}
              valueFormatter={valueFormatter}
              tone="total"
            />
          </dl>
          <FlowArrow />

          <dl>
            <FlowMetric
              label="(-) 법인세비용"
              value={latestMetrics.incomeTaxExpense}
              valueFormatter={valueFormatter}
              tone="expense"
            />
          </dl>
          <FlowArrow />

          <dl>
            <FlowMetric
              label="당기순이익"
              value={latestMetrics.netIncome}
              valueFormatter={valueFormatter}
              tone="total"
            />
          </dl>
        </div>
      </div>
    </Box>
  );
}

"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  NameType,
  Payload,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { StatusState } from "@/components/common/StatusState";
import { toNumberOrNull } from "@/lib/financialNormalize";
import type { NumericValue } from "@/lib/format";
import type { YearlyDataApi } from "@/types/api";

const KOREAN_YEAR = String.fromCharCode(0xb144);

const SERIES = [
  { key: "costOfSales", label: "매출원가", color: "#2563eb" },
  { key: "sga", label: "판매비와관리비", color: "#0f766e" },
  { key: "operatingProfit", label: "영업이익", color: "#ea580c" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

type CostCompositionPoint = {
  year: string;
  costOfSales: number;
  sga: number;
  operatingProfit: number;
};

type CostCompositionChartProps = {
  history: YearlyDataApi[];
  valueFormatter: (value: NumericValue) => string;
};

type CostCompositionTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<Payload<ValueType, NameType>>;
  valueFormatter: (value: NumericValue) => string;
};

function buildCostCompositionData(
  history: YearlyDataApi[]
): CostCompositionPoint[] {
  return history.reduce<CostCompositionPoint[]>((points, item) => {
    const costOfSales = toNumberOrNull(item.cost_of_sales, {
      allowNegative: true,
    });
    const sga = toNumberOrNull(item.sga, { allowNegative: true });
    const operatingProfit = toNumberOrNull(item.operating_profit, {
      allowNegative: true,
    });

    if (costOfSales === null || sga === null || operatingProfit === null) {
      return points;
    }

    points.push({
      year: String(item.fiscal_year),
      costOfSales,
      sga,
      operatingProfit,
    });

    return points;
  }, []);
}

function CostCompositionTooltip({
  active,
  label,
  payload,
  valueFormatter,
}: CostCompositionTooltipProps) {
  if (!active || !payload?.length) return null;

  const values = new Map<SeriesKey, number>();

  payload.forEach((item) => {
    const series = SERIES.find((candidate) => candidate.key === item.dataKey);

    if (
      !series ||
      typeof item.value !== "number" ||
      !Number.isFinite(item.value)
    ) {
      return;
    }

    values.set(series.key, item.value);
  });

  return (
    <div className="max-w-[calc(100vw-32px)] rounded-lg border border-sky-200 bg-white px-3 py-3 text-xs shadow-lg shadow-slate-900/10">
      <p className="font-semibold text-slate-900">
        {label}
        {KOREAN_YEAR}
      </p>
      <dl className="mt-2 space-y-1.5">
        {SERIES.map((series) => {
          const value = values.get(series.key);

          return (
            <div
              key={series.key}
              className="flex items-center justify-between gap-4"
            >
              <dt className="flex items-center gap-1.5 text-slate-500">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: series.color }}
                />
                {series.label}
              </dt>
              <dd
                className={
                  series.key === "operatingProfit" &&
                  typeof value === "number" &&
                  value < 0
                    ? "font-semibold text-rose-600"
                    : "font-semibold text-slate-900"
                }
              >
                {valueFormatter(value ?? null)}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export default function CostCompositionChart({
  history,
  valueFormatter,
}: CostCompositionChartProps) {
  const data = buildCostCompositionData(history);

  if (data.length === 0) {
    return (
      <div className="mt-5 h-[300px] w-full sm:h-[320px]">
        <StatusState
          variant="empty"
          title="실제 비용 구성을 표시할 재무 데이터가 부족합니다."
          description="세 항목이 모두 공시된 연도만 비용 구성에 표시됩니다."
          compact
          className="flex h-full items-center"
        />
      </div>
    );
  }

  return (
    <div
      className="mt-5 h-[330px] w-full sm:h-[340px]"
      role="img"
      aria-label="연도별 매출원가, 판매비와관리비, 영업이익 구성 차트"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 16, right: 16, left: 6, bottom: 12 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            interval={0}
            minTickGap={8}
          />
          <YAxis
            tickFormatter={(value) =>
              valueFormatter(typeof value === "number" ? value : null)
            }
            tick={{ fontSize: 10, fill: "#64748b" }}
            width={58}
            tickLine={false}
            axisLine={false}
          />
          <ReferenceLine
            y={0}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth={1}
            ifOverflow="extendDomain"
          />
          <Tooltip
            cursor={{ fill: "rgba(219, 234, 254, 0.35)" }}
            content={(props) => (
              <CostCompositionTooltip
                {...props}
                valueFormatter={valueFormatter}
              />
            )}
            wrapperStyle={{ maxWidth: "calc(100vw - 32px)", zIndex: 60 }}
          />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 11, lineHeight: "18px", paddingTop: 6 }}
          />
          {SERIES.map((series, index) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              stackId="actual-cost-composition"
              fill={series.color}
              radius={index === SERIES.length - 1 ? [6, 6, 0, 0] : 0}
              maxBarSize={52}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

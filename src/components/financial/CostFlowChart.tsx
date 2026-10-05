"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
const REVENUE_LABEL = "매출액";
const ESTIMATED_COST_LABEL = "영업비용 추정치";
const OPERATING_PROFIT_LABEL = "영업이익";

type CostFlowPoint = {
  year: string;
  revenue: number;
  estimatedOperatingCost: number;
  operatingProfit: number;
};

type CostFlowChartProps = {
  history: YearlyDataApi[];
  valueFormatter: (value: NumericValue) => string;
};

type CostFlowTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<Payload<ValueType, NameType>>;
  valueFormatter: (value: NumericValue) => string;
};

const TOOLTIP_ORDER = [
  "revenue",
  "estimatedOperatingCost",
  "operatingProfit",
] as const;

const SERIES_LABELS: Record<(typeof TOOLTIP_ORDER)[number], string> = {
  revenue: REVENUE_LABEL,
  estimatedOperatingCost: ESTIMATED_COST_LABEL,
  operatingProfit: OPERATING_PROFIT_LABEL,
};

const SERIES_COLORS: Record<(typeof TOOLTIP_ORDER)[number], string> = {
  revenue: "#2563eb",
  estimatedOperatingCost: "#0f766e",
  operatingProfit: "#ea580c",
};

function buildCostFlowData(history: YearlyDataApi[]): CostFlowPoint[] {
  return history.reduce<CostFlowPoint[]>((points, item) => {
    const revenue = toNumberOrNull(item?.revenue, { allowNegative: true });
    const operatingProfit = toNumberOrNull(item?.operating_profit, {
      allowNegative: true,
    });

    if (revenue === null || operatingProfit === null) {
      return points;
    }

    const estimatedOperatingCost = revenue - operatingProfit;

    if (!Number.isFinite(estimatedOperatingCost)) {
      return points;
    }

    points.push({
      year: String(item.fiscal_year),
      revenue,
      estimatedOperatingCost,
      operatingProfit,
    });

    return points;
  }, []);
}

function CostFlowTooltip({
  active,
  label,
  payload,
  valueFormatter,
}: CostFlowTooltipProps) {
  if (!active || !payload?.length) return null;

  const values = new Map<(typeof TOOLTIP_ORDER)[number], number>();

  payload.forEach((item) => {
    if (
      typeof item.dataKey !== "string" ||
      !TOOLTIP_ORDER.includes(item.dataKey as (typeof TOOLTIP_ORDER)[number]) ||
      typeof item.value !== "number" ||
      !Number.isFinite(item.value)
    ) {
      return;
    }

    values.set(item.dataKey as (typeof TOOLTIP_ORDER)[number], item.value);
  });

  return (
    <div className="max-w-[calc(100vw-32px)] rounded-lg border border-sky-200 bg-white px-3 py-3 text-xs shadow-lg shadow-slate-900/10">
      <p className="font-semibold text-slate-900">
        {label}
        {KOREAN_YEAR}
      </p>
      <dl className="mt-2 space-y-1.5">
        {TOOLTIP_ORDER.map((key) => {
          const value = values.get(key);

          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-slate-500">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: SERIES_COLORS[key] }}
                />
                {SERIES_LABELS[key]}
              </dt>
              <dd
                className={
                  key === "operatingProfit" && typeof value === "number" && value < 0
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

export default function CostFlowChart({
  history,
  valueFormatter,
}: CostFlowChartProps) {
  const data = buildCostFlowData(history);

  if (data.length <= 1) {
    return (
      <div className="mt-5 h-[300px] w-full sm:h-[320px]">
        <StatusState
          variant="empty"
          title="비용 흐름을 계산할 수 있는 재무 데이터가 부족합니다."
          description="매출액과 영업이익이 모두 있는 연도만 그래프에 표시됩니다."
          compact
          className="flex h-full items-center"
        />
      </div>
    );
  }

  return (
    <div className="mt-5 h-[330px] w-full sm:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
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
              <CostFlowTooltip {...props} valueFormatter={valueFormatter} />
            )}
            wrapperStyle={{ maxWidth: "calc(100vw - 32px)", zIndex: 60 }}
          />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 11, lineHeight: "18px", paddingTop: 6 }}
          />
          <Bar
            dataKey="revenue"
            name={REVENUE_LABEL}
            fill={SERIES_COLORS.revenue}
            radius={[6, 6, 0, 0]}
            maxBarSize={34}
          />
          <Bar
            dataKey="estimatedOperatingCost"
            name={ESTIMATED_COST_LABEL}
            fill={SERIES_COLORS.estimatedOperatingCost}
            radius={[6, 6, 0, 0]}
            maxBarSize={34}
          />
          <Line
            type="monotone"
            dataKey="operatingProfit"
            name={OPERATING_PROFIT_LABEL}
            stroke={SERIES_COLORS.operatingProfit}
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

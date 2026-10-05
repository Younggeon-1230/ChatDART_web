"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ActiveDotProps, DotItemDotProps } from "recharts";
import { StatusState } from "@/components/common/StatusState";
import { formatAmount } from "@/lib/formatters";
import type { NumericValue } from "@/lib/format";

const KOREAN_YEAR = String.fromCharCode(0xb144);

type Props = {
  title: string;
  labels: string[];
  values: Array<number | null>;
  compact?: boolean;
  valueFormatter?: (value: NumericValue) => string;
  yAxisWidth?: number;
  highlightProfitLoss?: boolean;
};

type ProfitLossTransition = {
  label: string;
  type: "loss" | "profit";
};

function getProfitLossLabel(title: string, value: number) {
  if (value >= 0) return title;
  if (title === "영업이익") return "영업손실";
  if (title === "당기순이익") return "당기순손실";
  return title;
}

function getProfitLossTransitions(
  labels: string[],
  values: Array<number | null>
) {
  return values.reduce<ProfitLossTransition[]>((transitions, value, index) => {
    const previous = values[index - 1];

    if (
      index === 0 ||
      typeof previous !== "number" ||
      !Number.isFinite(previous) ||
      typeof value !== "number" ||
      !Number.isFinite(value)
    ) {
      return transitions;
    }

    if (previous >= 0 && value < 0) {
      transitions.push({ label: labels[index], type: "loss" });
    } else if (previous < 0 && value >= 0) {
      transitions.push({ label: labels[index], type: "profit" });
    }

    return transitions;
  }, []);
}

function ProfitLossDot({
  cx,
  cy,
  value,
  active = false,
}: (DotItemDotProps | ActiveDotProps) & { active?: boolean }) {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof value !== "number"
  ) {
    return null;
  }

  const isLoss = value < 0;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={active ? 5 : 3.5}
      fill={isLoss ? "#fff1f2" : "#dbeafe"}
      stroke={isLoss ? "#e11d48" : "#1d4ed8"}
      strokeWidth={active ? 2.5 : 2}
    />
  );
}

export default function SimpleLineChart({
  title,
  labels,
  values,
  compact = false,
  valueFormatter = formatAmount,
  yAxisWidth = 64,
  highlightProfitLoss = false,
}: Props) {
  const safeTitle = typeof title === "string" ? title : "지표";
  const transitions = highlightProfitLoss
    ? getProfitLossTransitions(labels, values).slice(-2)
    : [];

  const validValueCount = values.filter(
    (value) => typeof value === "number" && Number.isFinite(value)
  ).length;

  const data = labels.map((label, i) => ({
    name: label,
    value:
      typeof values[i] === "number" && Number.isFinite(values[i])
        ? values[i]
        : null,
  }));

  if (validValueCount <= 1) {
    return (
      <div className={`w-full ${compact ? "h-[320px]" : "h-[340px]"}`}>
        <StatusState
          variant="empty"
          title="차트 데이터가 부족합니다"
          description="표시 가능한 연도별 값이 충분하지 않습니다."
          compact
          className="flex h-full items-center"
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className={compact ? "h-[320px]" : "h-[340px]"}>
        <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 14, right: 22, left: 8, bottom: 18 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            interval={0}
            minTickGap={8}
          />
          <YAxis
            tickFormatter={(value) => valueFormatter(value)}
            tick={{ fontSize: 11, fill: "#64748b" }}
            width={yAxisWidth}
            tickLine={false}
            axisLine={false}
          />
          {highlightProfitLoss && (
            <ReferenceLine
              y={0}
              stroke="#64748b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              ifOverflow="extendDomain"
              label={{
                value: "0원 기준",
                fill: "#64748b",
                fontSize: 11,
                position: "insideTopRight",
              }}
            />
          )}
          <Tooltip
            filterNull={false}
            formatter={(value) => {
              const numericValue = typeof value === "number" ? value : null;
              const formattedValue = valueFormatter(numericValue);

              if (
                highlightProfitLoss &&
                typeof numericValue === "number"
              ) {
                return [
                  <span
                    key="value"
                    className={numericValue < 0 ? "font-semibold text-rose-600" : undefined}
                  >
                    {formattedValue}
                  </span>,
                  getProfitLossLabel(safeTitle, numericValue),
                ];
              }

              return formattedValue;
            }}
            labelFormatter={(label) => `${label}${KOREAN_YEAR}`}
            contentStyle={{
              maxWidth: "min(320px, calc(100vw - 144px))",
              borderRadius: "12px",
              borderColor: "#bae6fd",
              boxShadow: "0 12px 24px rgba(15, 23, 42, 0.12)",
            }}
            itemStyle={{ whiteSpace: "normal", overflowWrap: "anywhere" }}
            labelStyle={{ whiteSpace: "normal", overflowWrap: "anywhere" }}
            wrapperStyle={{
              maxWidth: "min(320px, calc(100vw - 144px))",
              zIndex: 60,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, lineHeight: "20px" }} />
          <Line
            type="monotone"
            dataKey="value"
            name={safeTitle}
            stroke="#1d4ed8"
            strokeWidth={2.5}
            connectNulls={false}
            dot={highlightProfitLoss ? (props) => <ProfitLossDot {...props} /> : { r: 3, strokeWidth: 1.5 }}
            activeDot={
              highlightProfitLoss
                ? (props) => <ProfitLossDot {...props} active />
                : { r: 5 }
            }
          />
        </LineChart>
        </ResponsiveContainer>
      </div>
      {transitions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {transitions.map((transition) => (
            <span
              key={`${transition.label}-${transition.type}`}
              className={
                transition.type === "loss"
                  ? "rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
                  : "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
              }
            >
              {transition.label}년 {transition.type === "loss" ? "적자 전환" : "흑자 전환"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

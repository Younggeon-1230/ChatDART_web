"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatusState } from "@/components/common/StatusState";
import { formatAmount } from "@/lib/formatters";

const KOREAN_YEAR = String.fromCharCode(0xb144);

type Series = {
  name: string;
  values: Array<number | null>;
};

type Props = {
  labels: string[];
  series: Series[];
  compact?: boolean;
};

const CHART_COLORS = ["#0f172a", "#2563eb", "#059669", "#ea580c"];

export default function MultiLineChart({
  labels,
  series,
  compact = false,
}: Props) {
  const data = labels.map((label, i) => {
    const row: Record<string, string | number | null> = { name: label };

    series.forEach((item) => {
      const value = item.values[i];
      row[item.name] =
        typeof value === "number" && Number.isFinite(value) ? value : null;
    });

    return row;
  });
  const validValueCount = series.reduce(
    (count, item) =>
      count +
      item.values.filter(
        (value) => typeof value === "number" && Number.isFinite(value)
      ).length,
    0
  );

  if (validValueCount <= 1) {
    return (
      <div className={`w-full ${compact ? "h-[240px]" : "h-[260px]"}`}>
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
    <div className={`w-full ${compact ? "h-[240px]" : "h-[260px]"}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 18, left: 8, bottom: 12 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            interval={0}
            minTickGap={8}
          />
          <YAxis
            tickFormatter={(value) => formatAmount(value)}
            tick={{ fontSize: 10, fill: "#64748b" }}
            width={64}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) =>
              formatAmount(typeof value === "number" ? value : null)
            }
            labelFormatter={(label) => `${label}${KOREAN_YEAR}`}
            contentStyle={{
              maxWidth: "min(320px, calc(100vw - 144px))",
              borderRadius: "16px",
              borderColor: "#bfdbfe",
            }}
            itemStyle={{ whiteSpace: "normal", overflowWrap: "anywhere" }}
            labelStyle={{ whiteSpace: "normal", overflowWrap: "anywhere" }}
            wrapperStyle={{
              maxWidth: "min(320px, calc(100vw - 144px))",
              zIndex: 60,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, lineHeight: "18px" }} />
          {series.map((item, index) => (
            <Line
              key={item.name}
              type="monotone"
              dataKey={item.name}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

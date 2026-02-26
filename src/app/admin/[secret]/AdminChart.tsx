"use client";

import dynamic from "next/dynamic";
import {
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// SSR 비활성화 (Recharts는 브라우저 전용)
const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);

interface DataPoint {
  label: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  unit?: string;
  color?: string;
  height?: number;
  valueFormatter?: (v: number) => string;
}

export default function AdminChart({
  data,
  unit = "",
  color = "#6366f1",
  height = 200,
  valueFormatter,
}: Props) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400 text-sm"
        style={{ height }}
      >
        데이터 없음
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={36}
          tickFormatter={(v) => (unit === "$" ? `$${v.toFixed(3)}` : String(v))}
        />
        <Tooltip
          formatter={(v: number | undefined) => {
            const num = v ?? 0;
            return valueFormatter ? valueFormatter(num) : `${num}${unit}`;
          }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0] as [number, number, number, number]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TrendPoint } from "@/lib/analytics";
import { formatINR, formatINRCompact } from "@/lib/format";

type Metric = "revenue" | "bookings";

const AXIS_TICK = { fill: "var(--chart-axis)", fontSize: 12 };

/**
 * Revenue or booking volume over time. The two measures have different scales, so they're
 * toggled rather than drawn against two y-axes.
 */
export function TrendChart({ points, bucket }: { points: TrendPoint[]; bucket: "day" | "week" }) {
  const [metric, setMetric] = useState<Metric>("revenue");
  const format = metric === "revenue" ? formatINR : (v: number) => String(v);
  const total = points.reduce((sum, p) => sum + p[metric], 0);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{metric === "revenue" ? "Revenue" : "Bookings"} over time</h2>
          <p className="text-sm text-muted-foreground">
            {format(total)} total · per {bucket} ·{" "}
            {metric === "revenue" ? "bookings that went ahead plus fees kept, by booking date" : "all bookings created"}
          </p>
        </div>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <TabsList>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--chart-grid)" }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={56}
              allowDecimals={false}
              tickFormatter={(v: number) => (metric === "revenue" ? formatINRCompact(v) : String(v))}
            />
            <Tooltip
              cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as TrendPoint | undefined;
                if (!active || !point) return null;
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
                    <p className="font-medium">
                      {bucket === "week" ? `Week of ${point.label}` : point.label}
                    </p>
                    <p className="text-muted-foreground">
                      Revenue <span className="font-medium text-foreground">{formatINR(point.revenue)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Bookings <span className="font-medium text-foreground">{point.bookings}</span>
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#trend-fill)"
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2, fill: "var(--chart-1)" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

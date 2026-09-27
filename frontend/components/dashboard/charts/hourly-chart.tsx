"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { hourlyLoad } from "@/lib/analytics";
import { plural } from "@/lib/format";

const AXIS_TICK = { fill: "var(--chart-axis)", fontSize: 12 };

type HourPoint = ReturnType<typeof hourlyLoad>[number];

/** Appointment load by hour of day, to plan phlebotomist/desk staffing. */
export function HourlyChart({ data }: { data: HourPoint[] }) {
  const peak = data.reduce((best, p) => (p.count > best.count ? p : best), data[0]);
  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Busiest appointment hours</h2>
      <p className="text-sm text-muted-foreground">
        {peak && peak.count > 0 ? (
          <>
            Peak at <span className="font-medium text-foreground">{peak.label}</span> with {plural(peak.count, "visit")}
          </>
        ) : (
          "No active appointments in this period"
        )}
      </p>
      <div className="mt-6 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} interval={1} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as HourPoint | undefined;
                if (!active || !point) return null;
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
                    <p className="font-medium">{point.label}</p>
                    <p className="text-muted-foreground">
                      {plural(point.count, "appointment")}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

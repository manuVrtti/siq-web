'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { SCORE_RAMP, ChartTooltip, EmptyChart } from '@/components/analytics/chart-parts'

/**
 * Plan 019 — score distribution over ten 10-point buckets. Bars step through
 * the monochromatic blue ramp (pale → deep) so higher-scoring buckets read
 * darker, without introducing a second hue.
 */
export function ScoreHistogram({ buckets }: { buckets: { label: string; count: number }[] }) {
  const total = buckets.reduce((n, b) => n + b.count, 0)
  if (total === 0) return <EmptyChart text="No graded results yet." />

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          />
          <Tooltip
            cursor={{ fill: 'var(--accent)', opacity: 0.5 }}
            content={({ active, payload }) => {
              const row = payload?.[0]
              if (!active || !row) return null
              const count = Number(row.value)
              return (
                <ChartTooltip
                  title={`${String(row.payload.label)}%`}
                  line={`${count} candidate${count === 1 ? '' : 's'}`}
                />
              )
            }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {buckets.map((b, i) => (
              <Cell key={b.label} fill={SCORE_RAMP[i] ?? 'var(--chart-3)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

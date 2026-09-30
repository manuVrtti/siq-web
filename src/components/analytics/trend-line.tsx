'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartTooltip, EmptyChart } from '@/components/analytics/chart-parts'

/**
 * Plan 019 — average score over time (one point per exam, oldest → newest).
 * A blue-600 line over a pale blue fill that fades to transparent, so the
 * chart never reads as a solid block.
 */
export function TrendLine({
  points,
  emptyText = 'Not enough graded exams to show a trend yet.',
  valueLabel = 'average',
}: {
  points: { title: string; value: number; meta?: string }[]
  emptyText?: string
  /** Word after the % in the tooltip: "average" for cohorts, "score" for one person. */
  valueLabel?: string
}) {
  if (points.length === 0) return <EmptyChart text={emptyText} />
  const data = points.map((p, i) => ({ ...p, idx: i + 1 }))

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <defs>
            <linearGradient id="siq-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="idx"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickFormatter={(v: number) => `#${v}`}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          />
          <Tooltip
            cursor={{ stroke: 'var(--border)' }}
            content={({ active, payload }) => {
              const row = payload?.[0]
              if (!active || !row) return null
              const meta = row.payload.meta ? ` · ${String(row.payload.meta)}` : ''
              return (
                <ChartTooltip
                  title={String(row.payload.title)}
                  line={`${String(row.value)}% ${valueLabel}${meta}`}
                />
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#siq-trend-fill)"
            isAnimationActive={false}
            dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

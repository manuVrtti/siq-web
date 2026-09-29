/**
 * Plan 019 — shared chart chrome: the tooltip card and the empty state, so
 * every chart on every analytics page looks the same when hovered or empty.
 */

export function ChartTooltip({ title, line }: { title: string; line: string }) {
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground mt-0.5">{line}</p>
    </div>
  )
}

export function EmptyChart({ text }: { text: string }) {
  return (
    <div className="text-muted-foreground grid h-56 place-items-center rounded-xl border border-dashed px-6 text-center text-sm">
      {text}
    </div>
  )
}

/** Monochromatic blue ramp, pale → deep. Mirrors --chart-5 … --chart-1. */
export const BLUE_RAMP = [
  '#bfdbfe',
  '#bfdbfe',
  '#93c5fd',
  '#93c5fd',
  '#60a5fa',
  '#60a5fa',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e40af',
] as const

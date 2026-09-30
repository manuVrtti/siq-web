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

/** Forest ramp, pale → deep (low scores → high). Mirrors --chart-5 … --chart-1. */
export const SCORE_RAMP = [
  '#d5ebe2',
  '#d5ebe2',
  '#a9d5c4',
  '#a9d5c4',
  '#74b9a0',
  '#74b9a0',
  '#3e977c',
  '#1f7a62',
  '#0f5b4a',
  '#083a2f',
] as const

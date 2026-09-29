/**
 * Plan 019 — invited → started → submitted, as horizontal bars scaled to the
 * invited count. Pure CSS: three rows read faster as bars with numbers than
 * as a chart, and this renders on the server.
 */
export function CompletionFunnel({
  invited,
  started,
  submitted,
  timedOut,
  inProgress,
}: {
  invited: number
  started: number
  submitted: number
  timedOut: number
  inProgress: number
}) {
  const rows = [
    { label: 'Invited', value: invited, color: '#93c5fd' },
    { label: 'Started', value: started, color: '#60a5fa' },
    { label: 'Submitted', value: submitted, color: '#2563eb' },
  ]
  const base = Math.max(invited, 1)

  return (
    <div className="flex flex-col gap-4">
      {rows.map((r, i) => {
        const prev = i > 0 ? rows[i - 1]!.value : null
        const conversion = prev && prev > 0 ? Math.round((r.value / prev) * 100) : null
        return (
          <div key={r.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="siq-numeric">
                {r.value}
                {conversion !== null ? (
                  <span className="text-muted-foreground ml-2 text-xs">{conversion}% of previous</span>
                ) : null}
              </span>
            </div>
            <div className="bg-muted h-2.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${(r.value / base) * 100}%`, background: r.color }}
              />
            </div>
          </div>
        )
      })}
      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs">
        <span>
          In progress <span className="siq-numeric text-foreground">{inProgress}</span>
        </span>
        <span>
          Timed out <span className="siq-numeric text-foreground">{timedOut}</span>
        </span>
        <span>
          Not started{' '}
          <span className="siq-numeric text-foreground">{Math.max(0, invited - started)}</span>
        </span>
      </div>
    </div>
  )
}

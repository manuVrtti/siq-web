import Link from 'next/link'
import { ShieldAlert, ShieldCheck } from 'lucide-react'

import { RISK_STYLE, type Risk } from '@/lib/proctoring/integrity'
import { cn } from '@/lib/utils'

/** Plan 018b — compact integrity marker for tables (staff only). */
export function IntegrityBadge({ risk, flags, href }: { risk: Risk; flags: number; href?: string | null }) {
  const s = RISK_STYLE[risk]
  const body = (
    <span
      title={`${s.label}${flags ? ` · ${flags} event${flags === 1 ? '' : 's'}` : ''}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        risk === 'HIGH' ? 'bg-destructive/10 text-destructive' : risk === 'REVIEW' ? 'bg-warning/15 text-warning' : 'bg-success/10 text-success',
      )}
    >
      {risk === 'CLEAR' ? <ShieldCheck className="size-3" aria-hidden /> : <ShieldAlert className="size-3" aria-hidden />}
      {s.label}
      {flags ? <span className="font-normal opacity-80">· {flags}</span> : null}
    </span>
  )
  return href ? (
    <Link href={href} className="hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  )
}

import { Check, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * "Who can do what", in plain words — shown in the admin panels so the
 * hierarchy is never a guess. Mirrors services/people.ts and
 * docs/roles-and-permissions.md; change all three together.
 */
const ROWS: { what: string; sa: boolean | string; ca: boolean | string; hod: boolean | string }[] = [
  { what: 'Create colleges & companies', sa: true, ca: false, hod: false },
  { what: 'Add / remove College Admins', sa: true, ca: 'own college', hod: false },
  { what: 'Add / remove HODs, set their departments', sa: true, ca: 'own college', hod: false },
  { what: 'Create & edit departments', sa: true, ca: 'own college', hod: false },
  { what: 'Import, edit, move & remove students', sa: true, ca: 'own college', hod: 'own departments' },
  { what: 'Build, publish & assign tests', sa: true, ca: 'own college', hod: 'own departments' },
  { what: 'Results, grading & analytics', sa: true, ca: 'own college', hod: 'own departments' },
  { what: 'College settings', sa: true, ca: 'own college', hod: false },
  { what: 'Suspend accounts · grant Super Admin', sa: true, ca: false, hod: false },
]

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <Check className="text-success mx-auto size-4" aria-label="Yes" />
  if (v === false) return <Minus className="text-muted-foreground/50 mx-auto size-4" aria-label="No" />
  return <span className="text-xs font-medium">{v}</span>
}

export function AccessMatrix({ highlight }: { highlight?: 'sa' | 'ca' | 'hod' }) {
  const col = (k: 'sa' | 'ca' | 'hod') => cn('px-3 py-2.5 text-center', highlight === k && 'bg-highlight-tint/60')
  return (
    <div className="siq-card overflow-hidden">
      <div className="border-b px-5 py-4">
        <h2 className="text-[15px] font-semibold">Who can do what</h2>
        <p className="text-muted-foreground text-xs">Super Admin runs the platform · College Admin runs a college · HOD runs their departments.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">Action</th>
              <th className={col('sa')}>Super Admin</th>
              <th className={col('ca')}>College Admin</th>
              <th className={col('hod')}>HOD</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ROWS.map((r) => (
              <tr key={r.what}>
                <td className="px-5 py-2.5">{r.what}</td>
                <td className={col('sa')}>
                  <Cell v={r.sa} />
                </td>
                <td className={col('ca')}>
                  <Cell v={r.ca} />
                </td>
                <td className={col('hod')}>
                  <Cell v={r.hod} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

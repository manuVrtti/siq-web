import Link from 'next/link'
import { ArrowRight, Rocket } from 'lucide-react'

import { Ring } from '@/components/motion/animated'
import type { Step } from '@/services/onboarding'

/** Manager dashboard nudge while the setup checklist isn't finished. */
export function SetupCard({ slug, done, total, next }: { slug: string; done: number; total: number; next: Step }) {
  return (
    <Link
      href={`/${slug}/welcome`}
      className="siq-card siq-lift siq-rise group flex flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center"
    >
      <Ring percent={(done / total) * 100} size={56} stroke={6}>
        <span className="siq-numeric text-xs font-semibold">
          {done}/{total}
        </span>
      </Ring>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Rocket className="text-highlight size-4" aria-hidden /> Finish setting up
        </p>
        <p className="text-muted-foreground text-sm">
          Next: <span className="text-foreground font-medium">{next.title}</span> — {next.body}
        </p>
      </div>
      <span className="text-primary inline-flex items-center gap-1 text-sm font-semibold">
        Continue <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  )
}

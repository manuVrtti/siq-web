import Link from 'next/link'
import { PauseCircle } from 'lucide-react'

import { BrandMark } from '@/components/brand/mark'

/** Shown to members of an organization a Super Admin has suspended. */
export function OrgPaused({ name }: { name: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="siq-card siq-rise w-full max-w-md p-8 text-center">
        <BrandMark className="mx-auto size-9" />
        <span className="bg-warning/10 text-warning mx-auto mt-6 grid size-14 place-items-center rounded-2xl">
          <PauseCircle className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold">{name} is paused</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          SelectIQ access for this college is paused right now. Your data is safe and nothing has been deleted. Please contact your
          placement cell or SelectIQ support.
        </p>
        <Link href="/select-org" className="text-primary mt-6 inline-block text-sm font-semibold hover:underline">
          Switch workspace
        </Link>
      </div>
    </main>
  )
}

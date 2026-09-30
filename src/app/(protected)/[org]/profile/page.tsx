import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, ChevronRight } from 'lucide-react'

import { ProfileSectionView } from '@/components/profile/profile-section-view'
import { Initials } from '@/components/dashboard/bits'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { cn } from '@/lib/utils'
import { DEGREES, graduationYears } from '@/lib/validators/profile'
import { computeCompleteness, getProfile } from '@/services/profile'

export const metadata: Metadata = { title: 'My profile — SelectIQ' }

const SECTIONS = [
  { key: 'basics', label: 'Basics' },
  { key: 'academics', label: 'Academics' },
  { key: 'education', label: 'Education' },
  { key: 'experience', label: 'Experience' },
  { key: 'projects', label: 'Projects' },
  { key: 'skills', label: 'Skills' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'links', label: 'Résumé & links' },
  { key: 'preferences', label: 'Preferences' },
] as const

const SECTION_HELP: Record<string, string> = {
  basics: 'How you appear to your placement cell and recruiters.',
  academics: 'Your current degree and scores — used for drive eligibility.',
  education: 'Degree, Class 12 and Class 10.',
  experience: 'Internships, part-time and freelance work.',
  projects: 'What you built and what you did on it.',
  skills: 'Languages, frameworks, tools and subjects.',
  achievements: 'Hackathons, certifications, ranks, awards.',
  links: 'Your résumé and where to see your work.',
  preferences: 'The roles and places you want.',
}

/**
 * Candidate profile — ABtalks-style: identity + strength header, a step list
 * with completion ticks, and one section editor at a time. The section lives
 * in the URL (?section=…) so each step is linkable and survives refresh.
 * Student-only; staff are sent to account settings.
 */
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<{ section?: string }>
}) {
  const { org: slug } = await params
  const user = (await getCurrentUser())!
  if (user.role !== 'STUDENT') redirect(`/${slug}/settings/profile`)

  const { section: rawSection } = await searchParams
  const section = SECTIONS.some((s) => s.key === rawSection) ? rawSection! : 'basics'

  const full = await getProfile(user.id)
  const { percent, items } = computeCompleteness(full)
  const doneBySection = new Map<string, boolean>()
  for (const i of items) doneBySection.set(i.section, (doneBySection.get(i.section) ?? true) && i.done)
  const nextUp = items.filter((i) => !i.done).sort((a, b) => b.weight - a.weight).slice(0, 3)
  const pr = full.profile
  const base = `/${slug}/profile`

  // Plain JSON for the client editors (Dates → ISO strings).
  const json = JSON.parse(
    JSON.stringify({
      user: full.user,
      profile: pr ? { ...pr, education: undefined, experience: undefined, projects: undefined, achievements: undefined } : null,
      education: pr?.education ?? [],
      experience: pr?.experience ?? [],
      projects: pr?.projects ?? [],
      achievements: pr?.achievements ?? [],
    }),
  )

  const r = 26
  const c = 2 * Math.PI * r

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Identity + strength */}
      <section className="siq-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="[&>span]:size-14 [&>span]:text-base">
            <Initials name={full.user.name} email={full.user.email} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[22px] leading-tight font-semibold tracking-tight">
              {full.user.name ?? 'Your profile'}
            </h1>
            <p className="text-muted-foreground truncate text-sm">
              {pr?.headline ??
                ([pr?.degree, pr?.branch, pr?.graduationYear ? `Class of ${pr.graduationYear}` : null]
                  .filter(Boolean)
                  .join(' · ') ||
                  full.user.email)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:border-l sm:pl-6">
          <div className="relative size-16 shrink-0">
            <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden>
              <circle cx="32" cy="32" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c - (percent / 100) * c}
              />
            </svg>
            <span className="siq-numeric absolute inset-0 grid place-items-center text-sm font-semibold">
              {percent}%
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {percent >= 90 ? 'Profile looks strong' : percent >= 60 ? 'Getting there' : 'Profile strength'}
            </p>
            {nextUp.length ? (
              <ul className="text-muted-foreground mt-0.5 text-xs">
                {nextUp.map((n) => (
                  <li key={n.key}>
                    <Link href={`${base}?section=${n.section}`} className="hover:text-primary">
                      + {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">Everything filled in. Keep it current.</p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Step list */}
        <nav aria-label="Profile sections" className="siq-card h-fit p-2 lg:sticky lg:top-20">
          <ol className="flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map((s, i) => {
              const active = s.key === section
              const done = doneBySection.get(s.key)
              return (
                <li key={s.key} className="shrink-0">
                  <Link
                    href={`${base}?section=${s.key}`}
                    aria-current={active ? 'step' : undefined}
                    scroll={false}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      active ? 'bg-primary/10 text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'siq-numeric grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
                        done ? 'bg-success text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted',
                      )}
                    >
                      {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
                    </span>
                    <span className="whitespace-nowrap">{s.label}</span>
                    {active ? <ChevronRight className="ml-auto hidden size-4 lg:block" aria-hidden /> : null}
                  </Link>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* Editor */}
        <section className="siq-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold">{SECTIONS.find((s) => s.key === section)!.label}</h2>
          <p className="text-muted-foreground mt-1 mb-6 text-sm">{SECTION_HELP[section]}</p>
          {/* key = section so each editor starts from fresh server data */}
          <ProfileSectionView
            key={section}
            section={section}
            data={json}
            userId={user.id}
            degrees={[...DEGREES]}
            years={graduationYears()}
          />
        </section>
      </div>
    </div>
  )
}

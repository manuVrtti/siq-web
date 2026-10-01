import {
  Bell,
  Building2,
  CalendarClock,
  Camera,
  Check,
  FileSpreadsheet,
  Lock,
  Send,
  Sparkles,
  TrendingUp,
  Trophy,
  UserRound,
} from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Story-mode illustrations. Pure markup + CSS animations (globals.css
 * siq-in-* / siq-draw / siq-float …), choreographed with the --d delay
 * variable. Each scene is re-mounted per chapter, so it replays.
 * Sample names and numbers only — never real data.
 */

const d = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties
const card = 'rounded-2xl bg-white text-foreground shadow-2xl shadow-black/25'

/* ---------------------------------------------------------------- student */

export function SceneAssigned() {
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-sm">
      {[
        { t: 'TCS NQT Mock — Round 1', s: 'Opens tomorrow, 10:00 am', delay: 150, x: 'left-0 top-6' },
        { t: 'DSA Weekly — Arrays', s: 'Open now · 60 min', delay: 600, x: 'right-0 top-[104px]' },
      ].map((n) => (
        <div key={n.t} className={cn(card, 'siq-in-right absolute flex w-[88%] items-center gap-3 p-3.5', n.x)} style={d(n.delay)}>
          <span className="bg-highlight-tint text-highlight-foreground grid size-10 shrink-0 place-items-center rounded-xl">
            <Bell className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-medium">ABES Placement Cell · now</p>
            <p className="truncate text-sm font-semibold">{n.t}</p>
            <p className="text-muted-foreground text-xs">{n.s}</p>
          </div>
        </div>
      ))}
      <div className="siq-in-up absolute bottom-2 left-1/2 w-[78%] -translate-x-1/2" style={d(1100)}>
        <div className="siq-float flex items-center justify-center gap-2 rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
          <CalendarClock className="size-4 text-white/80" />
          {['01', '04', '32'].map((v, i) => (
            <span key={v} className="flex items-center gap-2">
              <span className="rounded-lg bg-white px-2.5 py-1.5 text-lg font-semibold text-[var(--primary)] tabular-nums">{v}</span>
              {i < 2 ? <span className="siq-blink text-lg font-semibold">:</span> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SceneSecureBrowser() {
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-sm">
      <div className={cn(card, 'siq-in-scale absolute inset-x-0 top-2 overflow-hidden')} style={d(100)}>
        <div className="bg-muted flex items-center gap-2 border-b px-3 py-2">
          <span className="flex gap-1">
            <i className="size-2.5 rounded-full bg-[#ff5f57]" />
            <i className="size-2.5 rounded-full bg-[#febc2e]" />
            <i className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="text-muted-foreground mx-auto flex items-center gap-1 text-[11px] font-medium">
            <Lock className="size-3" /> SelectIQ Secure Browser
          </span>
          <span className="bg-primary rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">42:18</span>
        </div>
        <div className="relative p-4">
          <span className="bg-primary/40 absolute inset-x-0 top-0 h-px siq-scan" style={{ '--scan': '170px' } as React.CSSProperties} />
          <p className="text-muted-foreground text-[11px] font-medium">Question 7 of 30</p>
          <div className="bg-muted mt-2 h-2.5 w-11/12 rounded" />
          <div className="bg-muted mt-1.5 h-2.5 w-2/3 rounded" />
          <div className="mt-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="siq-in-left flex items-center gap-2 rounded-lg border px-2.5 py-2" style={d(400 + i * 120)}>
                <span className={cn('grid size-4 place-items-center rounded-full border-2', i === 1 ? 'border-primary' : 'border-input')}>
                  {i === 1 ? <span className="bg-primary siq-in-scale size-2 rounded-full" style={d(1300)} /> : null}
                </span>
                <span className={cn('h-2 rounded', i === 1 ? 'bg-primary/30 w-1/2' : 'bg-muted w-2/5')} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="siq-in-up absolute right-0 bottom-0 flex items-center gap-2 rounded-full bg-[var(--primary)] py-1.5 pr-3 pl-1.5 text-xs font-medium whitespace-nowrap text-white shadow-xl ring-1 ring-white/25" style={d(1500)}>
        <span className="grid size-7 place-items-center rounded-full bg-white/20">
          <Camera className="size-3.5" />
        </span>
        <span className="siq-live" /> Proctored · answers saved
      </div>
    </div>
  )
}

export function SceneResult() {
  const r = 54
  const c = 2 * Math.PI * r
  return (
    <div className="relative mx-auto grid h-[300px] w-full max-w-sm place-items-center">
      {/* confetti */}
      {[
        ['left-6 top-8', 'bg-highlight', 900],
        ['right-10 top-4', 'bg-white', 1000],
        ['left-14 bottom-16', 'bg-white/70', 1100],
        ['right-6 bottom-24', 'bg-highlight', 1200],
        ['left-1/2 top-0', 'bg-white/60', 1050],
      ].map(([pos, color, delay]) => (
        <span key={pos as string} className={cn('siq-in-scale absolute size-2.5 rotate-45 rounded-sm', pos as string, color as string)} style={d(delay as number)} />
      ))}
      <div className={cn(card, 'siq-in-scale flex w-[86%] flex-col items-center p-6')} style={d(100)}>
        <div className="relative">
          <svg width="132" height="132" className="-rotate-90">
            <circle cx="66" cy="66" r={r} fill="none" strokeWidth="12" className="stroke-muted" />
            <circle
              cx="66"
              cy="66"
              r={r}
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              className="stroke-primary siq-draw"
              strokeDashoffset={c * 0.12}
              style={{ '--len': `${c}`, strokeDasharray: c, ...d(300) } as React.CSSProperties}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-display text-3xl font-semibold">88%</p>
              <p className="text-muted-foreground text-[10px] tracking-wide uppercase">score</p>
            </div>
          </div>
        </div>
        <span className="bg-success/10 text-success siq-in-scale mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={d(1100)}>
          <Trophy className="size-3.5" /> Passed
        </span>
        <p className="siq-in-up text-muted-foreground mt-2 text-xs" style={d(1300)}>
          Ahead of <b className="text-foreground">92%</b> of 412 candidates
        </p>
      </div>
    </div>
  )
}

export function SceneInsights() {
  const topics = [
    { t: 'Quantitative Aptitude', v: 91, good: true },
    { t: 'SQL', v: 84, good: true },
    { t: 'Graphs', v: 45, good: false },
    { t: 'Dynamic Programming', v: 38, good: false },
  ]
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-sm">
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-5')} style={d(100)}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Topic mastery</p>
          <TrendingUp className="text-primary size-4" />
        </div>
        <ul className="mt-3 flex flex-col gap-3">
          {topics.map((x, i) => (
            <li key={x.t}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium">{x.t}</span>
                <span className={x.good ? 'text-success font-semibold' : 'text-warning font-semibold'}>{x.good ? 'Strong' : 'Practise'}</span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div className={cn('siq-grow-w h-full rounded-full', x.good ? 'bg-success' : 'bg-highlight')} style={{ width: `${x.v}%`, ...d(400 + i * 150) }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="siq-in-up absolute right-2 bottom-1 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-medium backdrop-blur-sm" style={d(1300)}>
        <Sparkles className="text-highlight size-4" /> Next: 20 DP problems this week
      </div>
    </div>
  )
}

/* ------------------------------------------------------- college admin */

export function SceneDepartments() {
  const depts = [
    { c: 'CSE', x: 'left-0', h: 'Dr. Iyer' },
    { c: 'IT', x: 'left-1/2 -translate-x-1/2', h: 'Dr. Rao' },
    { c: 'ECE', x: 'right-0', h: 'Dr. Khan' },
  ]
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-sm">
      <div className={cn(card, 'siq-in-scale absolute top-0 left-1/2 flex -translate-x-1/2 items-center gap-2 px-4 py-3')} style={d(100)}>
        <Building2 className="text-primary size-5" />
        <span className="text-sm font-semibold">ABES Engineering College</span>
      </div>
      <svg className="absolute inset-x-0 top-[52px] h-16 w-full" viewBox="0 0 384 64" fill="none" preserveAspectRatio="none">
        {['M192 0 V24 H48 V64', 'M192 0 V64', 'M192 0 V24 H336 V64'].map((path, i) => (
          <path key={path} d={path} stroke="white" strokeOpacity="0.5" strokeWidth="2" className="siq-draw" style={{ '--len': '260', ...d(400 + i * 150) } as React.CSSProperties} />
        ))}
      </svg>
      {depts.map((x, i) => (
        <div key={x.c} className={cn('absolute top-[118px] flex w-[30%] flex-col items-center gap-2', x.x)}>
          <div className={cn(card, 'siq-in-scale w-full px-2 py-3 text-center')} style={d(900 + i * 150)}>
            <p className="bg-primary mx-auto w-fit rounded-md px-2 py-0.5 text-xs font-bold text-white">{x.c}</p>
            <p className="text-muted-foreground mt-1.5 text-[10px]">{[412, 380, 296][i]} students</p>
          </div>
          <div className="siq-in-up flex items-center gap-1.5 rounded-full bg-white/15 py-1 pr-2.5 pl-1 text-[11px] font-medium backdrop-blur-sm" style={d(1400 + i * 150)}>
            <span className="bg-highlight text-highlight-foreground grid size-5 place-items-center rounded-full">
              <UserRound className="size-3" />
            </span>
            {x.h}
          </div>
        </div>
      ))}
      <p className="siq-in-fade absolute inset-x-0 bottom-0 text-center text-xs text-white/70" style={d(1900)}>
        Each HOD sees only their department
      </p>
    </div>
  )
}

export function SceneImport() {
  const rows = ['Aarav Sharma', 'Diya Patel', 'Kabir Singh', 'Meera Nair', 'Rohan Gupta']
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-sm">
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 overflow-hidden')} style={d(100)}>
        <div className="bg-muted flex items-center gap-2 border-b px-3 py-2 text-xs font-semibold">
          <FileSpreadsheet className="text-success size-4" /> CSE-2026-roster.xlsx
        </div>
        <ul className="divide-y text-xs">
          {rows.map((n, i) => (
            <li key={n} className="siq-in-left flex items-center gap-3 px-3 py-2" style={d(350 + i * 140)}>
              <span className="w-28 truncate font-medium">{n}</span>
              <span className="bg-muted h-1.5 flex-1 rounded" />
              <span className="bg-accent text-accent-foreground rounded px-1.5 text-[10px] font-semibold">CSE</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5 6.5 12 13 4.5" stroke="var(--success)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="siq-draw" style={{ '--len': '20', ...d(800 + i * 140) } as React.CSSProperties} />
              </svg>
            </li>
          ))}
        </ul>
      </div>
      <div className="siq-in-scale absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold whitespace-nowrap text-[var(--primary)] shadow-xl" style={d(1600)}>
        <Check className="size-4" /> 412 students imported
      </div>
    </div>
  )
}

export function SceneBuild() {
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-sm">
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-4')} style={d(100)}>
        <p className="text-sm font-semibold">Infosys Aptitude Practice</p>
        <p className="text-muted-foreground text-[11px]">45 min · 30 questions · pass at 60%</p>
        <div className="mt-3 flex flex-col gap-2">
          {['Quantitative · 12 q', 'Logical reasoning · 10 q', 'Verbal ability · 8 q'].map((s, i) => (
            <div key={s} className="siq-in-right flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={d(400 + i * 180)}>
              <span className="bg-primary/15 text-primary grid size-5 place-items-center rounded text-[10px] font-bold">{i + 1}</span>
              <span className="font-medium">{s}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <span className="bg-primary siq-in-scale inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={d(1200)}>
            <Send className="size-3.5" /> Publish &amp; assign
          </span>
        </div>
      </div>
      <div className="siq-in-up absolute right-0 bottom-2 left-6 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2.5 text-xs font-medium backdrop-blur-sm" style={d(1600)}>
        <span className="bg-highlight text-highlight-foreground grid size-6 place-items-center rounded-full">
          <Check className="size-3.5" />
        </span>
        Assigned to CSE 2026 · 412 invites sent
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- HOD */

export function SceneHodTeam() {
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-sm">
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-5')} style={d(100)}>
        <div className="flex items-center gap-2">
          <span className="bg-primary rounded-md px-2 py-0.5 text-xs font-bold text-white">CSE</span>
          <p className="text-sm font-semibold">Your department</p>
        </div>
        <div className="mt-4 grid grid-cols-6 gap-2">
          {Array.from({ length: 18 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'siq-in-scale grid aspect-square place-items-center rounded-full text-[10px] font-semibold',
                i % 5 === 3 ? 'bg-highlight text-highlight-foreground' : 'bg-accent text-accent-foreground',
              )}
              style={d(300 + i * 45)}
            >
              {'ADKMRSPNVT'[i % 10]}
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['412', 'students'],
            ['74%', 'avg score'],
            ['6', 'tests'],
          ].map(([v, l], i) => (
            <div key={l} className="bg-muted/60 siq-in-up rounded-lg py-2" style={d(1300 + i * 120)}>
              <p className="font-display text-base font-semibold">{v}</p>
              <p className="text-muted-foreground text-[10px]">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  Briefcase,
  Building2,
  Check,
  CircleCheck,
  ClipboardCheck,
  FileSpreadsheet,
  Globe2,
  Lock,
  PenLine,
  Rocket,
  ScrollText,
  Send,
  ShieldCheck,
  Star,
  UserPlus,
  Users,
} from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Role-specific story scenes. Every role has its own four pictures — no
 * scene is shared between roles — and they take real data where it exists
 * (college name, departments, counts) so the story is about *their* college.
 * Sample values are used only when real data doesn't exist yet.
 */

const d = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties
const card = 'rounded-2xl bg-white text-foreground shadow-2xl shadow-black/25'
const wrap = 'relative mx-auto h-[300px] w-full max-w-sm'
export type DeptStat = { code: string; students: number }

/* ======================= College Admin ======================= */

export function SceneCollegeTree({ orgName, departments }: { orgName: string; departments: DeptStat[] }) {
  const list = (departments.length ? departments : [
    { code: 'CSE', students: 412 },
    { code: 'IT', students: 380 },
    { code: 'ECE', students: 296 },
  ]).slice(0, 4)
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-scale absolute top-0 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 px-4 py-3')} style={d(100)}>
        <Building2 className="text-primary size-5 shrink-0" />
        <span className="truncate text-sm font-semibold">{orgName}</span>
      </div>
      <div className="absolute inset-x-0 top-[70px] flex justify-center">
        <span className="siq-in-fade h-8 w-px bg-white/50" style={d(400)} />
      </div>
      <div className="absolute inset-x-0 top-[102px] grid gap-2" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0,1fr))` }}>
        {list.map((x, i) => (
          <div key={x.code} className={cn(card, 'siq-in-scale px-2 py-3 text-center')} style={d(600 + i * 140)}>
            <p className="bg-primary mx-auto w-fit rounded-md px-2 py-0.5 text-xs font-bold text-white">{x.code}</p>
            <p className="text-muted-foreground mt-1.5 text-[10px]">{x.students} students</p>
          </div>
        ))}
      </div>
      <div className="siq-in-up absolute inset-x-6 bottom-2 rounded-xl bg-white/15 px-3 py-2 text-center text-xs font-medium backdrop-blur-sm" style={d(1300)}>
        {departments.length ? `${departments.length} departments set up` : 'Add departments like CSE, IT, ECE…'}
      </div>
    </div>
  )
}

export function SceneRosterUpload({ codes }: { codes: string[] }) {
  const c = codes.length ? codes : ['CSE', 'IT', 'ECE']
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute top-0 left-0 w-[52%] rotate-[-3deg] p-4')} style={d(100)}>
        <FileSpreadsheet className="text-success size-8" />
        <p className="mt-2 text-sm font-semibold">roster-2026.xlsx</p>
        <p className="text-muted-foreground text-[11px] leading-snug">name · email · phone · department</p>
      </div>
      <div className="siq-in-fade absolute top-[70px] left-[47%] text-2xl text-white" style={d(600)}>→</div>
      <div className={cn(card, 'siq-in-right absolute top-16 right-0 w-[46%] p-3')} style={d(800)}>
        <p className="text-muted-foreground mb-2 text-[11px] font-medium">Sorted into departments</p>
        {c.slice(0, 3).map((code, i) => (
          <div key={code} className="mb-1.5 flex items-center gap-2">
            <span className="bg-accent text-accent-foreground w-12 rounded px-1 text-center text-[10px] font-bold">{code}</span>
            <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
              <span className="bg-primary siq-grow-w block h-full rounded-full" style={{ width: `${[78, 64, 52][i]}%`, ...d(1100 + i * 150) }} />
            </span>
          </div>
        ))}
      </div>
      <div className="siq-in-scale absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold whitespace-nowrap text-[var(--primary)] shadow-xl" style={d(1600)}>
        <Check className="size-4" /> Students can sign in now
      </div>
    </div>
  )
}

export function SceneInviteTeam({ codes }: { codes: string[] }) {
  const c = codes.length ? codes : ['CSE', 'IT']
  const people = [
    { n: 'Placement Officer', r: 'College Admin', badge: 'bg-primary text-white', icon: ShieldCheck },
    { n: `HOD · ${c[0]}`, r: 'HOD', badge: 'bg-highlight text-highlight-foreground', icon: Users },
    { n: `HOD · ${c[1] ?? c[0]}`, r: 'HOD', badge: 'bg-highlight text-highlight-foreground', icon: Users },
  ]
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-4')} style={d(100)}>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="text-primary size-4" /> Your team
        </div>
        {people.map((p, i) => (
          <div key={p.n} className="siq-in-right mb-2 flex items-center gap-3 rounded-xl border px-3 py-2" style={d(400 + i * 220)}>
            <span className={cn('grid size-7 place-items-center rounded-full', p.badge)}>
              <p.icon className="size-3.5" />
            </span>
            <span className="flex-1 text-xs font-medium">{p.n}</span>
            <span className="text-muted-foreground text-[10px]">{p.r}</span>
            <Send className="text-primary siq-in-scale size-3.5" style={d(700 + i * 220)} />
          </div>
        ))}
      </div>
      <p className="siq-in-fade absolute inset-x-0 bottom-3 text-center text-xs text-white/75" style={d(1500)}>
        Invites go out by email — they get access on first sign-in
      </p>
    </div>
  )
}

export function SceneCollegeDashboard({ codes }: { codes: string[] }) {
  const c = (codes.length ? codes : ['CSE', 'IT', 'ECE', 'ME']).slice(0, 4)
  const vals = [82, 74, 61, 55]
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-4')} style={d(100)}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Placement readiness</p>
          <BarChart3 className="text-primary size-4" />
        </div>
        <div className="flex h-32 items-end justify-around gap-3">
          {c.map((code, i) => (
            <div key={code} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-semibold">{vals[i]}%</span>
              <span className="w-full overflow-hidden rounded-t-md bg-[var(--muted)]" style={{ height: '96px' }}>
                <span className="siq-in-up block w-full rounded-t-md bg-[var(--primary)]" style={{ height: `${vals[i]}%`, marginTop: `${100 - vals[i]!}%`, ...d(400 + i * 150) }} />
              </span>
              <span className="text-muted-foreground text-[10px] font-bold">{code}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="siq-in-up absolute right-2 bottom-1 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-medium backdrop-blur-sm" style={d(1300)}>
        <Activity className="text-highlight size-4" /> Every department, one view
      </div>
    </div>
  )
}

/* ============================ HOD ============================ */

export function SceneMyDepartment({ departments }: { departments: DeptStat[] }) {
  const list = departments.length ? departments : [{ code: 'CSE', students: 412 }]
  const total = list.reduce((n, x) => n + x.students, 0)
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-5')} style={d(100)}>
        <div className="flex flex-wrap items-center gap-1.5">
          {list.map((x) => (
            <span key={x.code} className="bg-primary rounded-md px-2 py-0.5 text-xs font-bold text-white">
              {x.code}
            </span>
          ))}
          <p className="ml-1 text-sm font-semibold">{list.length > 1 ? 'Your departments' : 'Your department'}</p>
        </div>
        <div className="mt-4 grid grid-cols-6 gap-2">
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className="bg-accent text-accent-foreground siq-in-scale grid aspect-square place-items-center rounded-full text-[10px] font-semibold" style={d(300 + i * 40)}>
              {'ADKMRSPNVT'[i % 10]}
            </span>
          ))}
        </div>
        <p className="siq-in-up text-muted-foreground mt-3 text-center text-xs" style={d(1200)}>
          <b className="text-foreground">{total || '—'}</b> students · only yours, nobody else&apos;s
        </p>
      </div>
      <div className="siq-in-up absolute inset-x-8 bottom-1 flex items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs backdrop-blur-sm" style={d(1500)}>
        <Lock className="size-3.5" /> Other departments stay private
      </div>
    </div>
  )
}

export function SceneDepartmentTest({ code }: { code: string }) {
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-4')} style={d(100)}>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="text-primary size-4" />
          <p className="text-sm font-semibold">{code} — DSA Weekly #4</p>
          <span className="bg-accent text-accent-foreground ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
            <Lock className="size-3" /> {code} only
          </span>
        </div>
        {['Arrays & strings · 6 q', 'Trees · 4 q', 'Graphs · 2 q'].map((s, i) => (
          <div key={s} className="siq-in-right mt-2 rounded-lg border px-3 py-2 text-xs" style={d(400 + i * 160)}>
            {s}
          </div>
        ))}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-muted-foreground text-[11px]">Assign to</span>
          <span className="siq-in-scale bg-highlight text-highlight-foreground rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={d(1100)}>
            {code} 2026 · Batch A
          </span>
        </div>
      </div>
    </div>
  )
}

export function SceneGradingQueue() {
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-4')} style={d(100)}>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <PenLine className="text-primary size-4" /> Needs your review · 3
        </div>
        <div className="bg-muted/60 rounded-xl p-3">
          <p className="text-muted-foreground text-[10px] font-medium">Q5 · Explain normalisation — Ananya</p>
          <div className="bg-muted mt-2 h-2 w-11/12 rounded" />
          <div className="bg-muted mt-1 h-2 w-3/4 rounded" />
          <div className="bg-muted mt-1 h-2 w-5/6 rounded" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-muted-foreground text-[11px]">Score</span>
          {[2, 4, 6, 8].map((v, i) => (
            <span
              key={v}
              className={cn('siq-in-scale grid size-7 place-items-center rounded-lg border text-[11px] font-semibold', v === 6 && 'bg-primary border-primary text-white')}
              style={d(500 + i * 120)}
            >
              {v}
            </span>
          ))}
          <span className="text-muted-foreground text-[11px]">/ 8</span>
        </div>
      </div>
      <div className="siq-in-up absolute inset-x-6 bottom-2 flex items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-medium backdrop-blur-sm" style={d(1300)}>
        <CircleCheck className="text-highlight size-4" /> Result updates for the student instantly
      </div>
    </div>
  )
}

export function SceneBatchProgress({ code }: { code: string }) {
  const lines = [
    { label: `${code} · A`, pts: '0,70 40,60 80,48 120,40 160,28 200,20', color: 'var(--primary)' },
    { label: `${code} · B`, pts: '0,80 40,74 80,66 120,62 160,50 200,44', color: 'var(--highlight)' },
  ]
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-4')} style={d(100)}>
        <p className="text-sm font-semibold">Batch progress · last 6 tests</p>
        <svg viewBox="0 0 200 90" className="mt-3 h-32 w-full" preserveAspectRatio="none">
          {[20, 45, 70].map((y) => (
            <line key={y} x1="0" x2="200" y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
          ))}
          {lines.map((l, i) => (
            <polyline key={l.label} points={l.pts} fill="none" stroke={l.color} strokeWidth="3" strokeLinecap="round" className="siq-draw" style={{ '--len': '260', strokeDasharray: 260, ...d(400 + i * 300) } as React.CSSProperties} />
          ))}
        </svg>
        <div className="mt-1 flex gap-3 text-[11px]">
          {lines.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: l.color }} /> {l.label}
            </span>
          ))}
        </div>
      </div>
      <div className="siq-in-up absolute right-2 bottom-1 rounded-xl bg-white/15 px-3 py-2 text-xs font-medium backdrop-blur-sm" style={d(1400)}>
        Weakest topic: Graphs → plan a revision class
      </div>
    </div>
  )
}

/* ========================= Super Admin ========================= */

export function ScenePlatformMap({ colleges }: { colleges: number }) {
  const nodes = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2
    return { x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * 38 }
  })
  return (
    <div className={wrap}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        {nodes.map((n, i) => (
          <line key={i} x1="50" y1="50" x2={n.x} y2={n.y} stroke="white" strokeOpacity="0.35" strokeWidth="0.6" className="siq-draw" style={{ '--len': '60', strokeDasharray: 60, ...d(300 + i * 80) } as React.CSSProperties} />
        ))}
      </svg>
      {nodes.map((n, i) => (
        <span
          key={i}
          className="siq-in-scale absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl bg-white shadow-lg"
          style={{ left: `${n.x}%`, top: `${n.y}%`, ...d(700 + i * 80) }}
        >
          <Building2 className="size-4 text-[var(--primary)]" />
        </span>
      ))}
      <div className="siq-in-scale absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-[var(--highlight)] text-center shadow-2xl" style={d(100)}>
        <div>
          <Globe2 className="mx-auto size-5 text-[var(--highlight-foreground)]" />
          <p className="mt-0.5 text-[10px] font-bold text-[var(--highlight-foreground)]">SelectIQ</p>
        </div>
      </div>
      <p className="siq-in-fade absolute inset-x-0 -bottom-1 text-center text-xs text-white/80" style={d(1500)}>
        {colleges ? `${colleges} college${colleges === 1 ? '' : 's'} today — built for hundreds` : 'Built for hundreds of colleges'}
      </p>
    </div>
  )
}

export function SceneOnboardWizard() {
  const steps = ['Basics', 'Admins', 'Departments', 'Live']
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-2 p-4')} style={d(100)}>
        <div className="flex items-center gap-1.5">
          {steps.map((s, i) => (
            <span key={s} className="flex flex-1 items-center gap-1.5">
              <span className={cn('siq-in-scale grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold', i < 3 ? 'bg-primary text-white' : 'bg-highlight text-highlight-foreground')} style={d(300 + i * 250)}>
                {i < 3 ? <Check className="size-3" /> : <Rocket className="size-3" />}
              </span>
              {i < steps.length - 1 ? <span className="bg-primary/30 siq-grow-w h-0.5 flex-1" style={{ width: '100%', ...d(400 + i * 250) }} /> : null}
            </span>
          ))}
        </div>
        <div className="mt-4 rounded-xl border p-3">
          <p className="text-sm font-semibold">Galgotias College of Engineering</p>
          <p className="text-muted-foreground text-[11px]">/galgotias · Greater Noida, Uttar Pradesh</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {['CSE', 'IT', 'ECE', 'AIML'].map((c, i) => (
              <span key={c} className="bg-accent text-accent-foreground siq-in-scale rounded px-1.5 text-[10px] font-bold" style={d(900 + i * 100)}>
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="siq-in-scale absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold whitespace-nowrap text-[var(--primary)] shadow-xl" style={d(1500)}>
        <Rocket className="size-4" /> College live in minutes
      </div>
    </div>
  )
}

export function SceneHealthMonitor() {
  const rows = [
    { t: 'No College Admin', n: 2, c: 'bg-destructive/10 text-destructive' },
    { t: 'No departments', n: 5, c: 'bg-warning/10 text-warning' },
    { t: 'Inactive 30 days', n: 9, c: 'bg-muted text-muted-foreground' },
    { t: 'Healthy', n: 184, c: 'bg-success/10 text-success' },
  ]
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-4')} style={d(100)}>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="text-warning size-4" /> College health
        </div>
        <div className="grid grid-cols-2 gap-2">
          {rows.map((r, i) => (
            <div key={r.t} className="siq-in-scale flex items-center justify-between rounded-xl border px-3 py-2.5" style={d(400 + i * 150)}>
              <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', r.c)}>{r.t}</span>
              <span className="font-display text-lg font-semibold">{r.n}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="siq-in-fade absolute inset-x-0 bottom-3 text-center text-xs text-white/80" style={d(1300)}>
        Click any number to see exactly which colleges
      </p>
    </div>
  )
}

export function SceneGovernance() {
  const log = ['granted Super Admin', 'suspended a college', 'added college staff', 'changed a role']
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute top-0 left-0 w-[64%] p-3.5')} style={d(100)}>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
          <ScrollText className="text-primary size-3.5" /> Audit log
        </div>
        {log.map((l, i) => (
          <div key={l} className="siq-in-left flex items-center gap-2 py-1 text-[11px]" style={d(300 + i * 150)}>
            <span className="bg-primary size-1.5 rounded-full" /> {l}
          </div>
        ))}
      </div>
      <div className={cn(card, 'siq-in-right absolute top-24 right-0 w-[52%] p-3.5')} style={d(900)}>
        <p className="text-xs font-semibold">Demo College</p>
        <p className="text-muted-foreground text-[10px]">Contract ended</p>
        <span className="bg-destructive/10 text-destructive mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold">
          <Ban className="size-3" /> Suspended — reversible
        </span>
      </div>
      <p className="siq-in-fade absolute inset-x-0 bottom-3 text-center text-xs text-white/80" style={d(1400)}>
        Every privileged action is recorded
      </p>
    </div>
  )
}

/* ========================== Recruiter ========================== */

export function SceneCompanyTest({ orgName }: { orgName: string }) {
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-4')} style={d(100)}>
        <div className="flex items-center gap-2">
          <Briefcase className="text-primary size-4" />
          <p className="truncate text-sm font-semibold">{orgName} — SDE Screening</p>
        </div>
        {['Coding · 2 problems', 'CS fundamentals · 15 q', 'Aptitude · 10 q'].map((s, i) => (
          <div key={s} className="siq-in-right mt-2 rounded-lg border px-3 py-2 text-xs" style={d(400 + i * 160)}>
            {s}
          </div>
        ))}
        <p className="siq-in-up text-muted-foreground mt-3 text-[11px]" style={d(1000)}>
          Proctored · 75 min · pass at 65%
        </p>
      </div>
    </div>
  )
}

export function SceneCandidatePool() {
  const campuses = ['ABES', 'KIET', 'GL Bajaj', 'Galgotias']
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-4')} style={d(100)}>
        <p className="text-sm font-semibold">Candidates from campuses</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {campuses.map((c, i) => (
            <span key={c} className="bg-accent text-accent-foreground siq-in-scale rounded-full px-2.5 py-1 text-[11px] font-semibold" style={d(300 + i * 120)}>
              {c}
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-8 gap-1.5">
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className="bg-muted siq-in-scale aspect-square rounded-full" style={d(800 + i * 30)} />
          ))}
        </div>
      </div>
      <p className="siq-in-fade absolute inset-x-0 bottom-3 text-center text-xs text-white/80" style={d(1600)}>
        Same test, every campus, one ranking
      </p>
    </div>
  )
}

export function SceneShortlist() {
  const rows = [
    { n: 'Ananya I.', s: 94, star: true },
    { n: 'Kabir S.', s: 91, star: true },
    { n: 'Meera N.', s: 88, star: false },
    { n: 'Rohan G.', s: 83, star: false },
  ]
  return (
    <div className={wrap}>
      <div className={cn(card, 'siq-in-up absolute inset-x-0 top-0 p-4')} style={d(100)}>
        <p className="mb-2 text-sm font-semibold">Shortlist</p>
        {rows.map((r, i) => (
          <div key={r.n} className="siq-in-left flex items-center gap-3 border-b py-2 text-xs last:border-0" style={d(300 + i * 150)}>
            <span className="text-muted-foreground w-4">{i + 1}</span>
            <span className="flex-1 font-medium">{r.n}</span>
            <span className="font-semibold tabular-nums">{r.s}%</span>
            <Star className={cn('siq-in-scale size-4', r.star ? 'fill-[var(--highlight)] text-[var(--highlight)]' : 'text-muted-foreground')} style={d(900 + i * 150)} />
          </div>
        ))}
      </div>
    </div>
  )
}

import 'server-only'

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import { QUESTION_TYPE_LABEL, labelOf } from '@/constants/labels'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

/**
 * Plan 020 — one candidate's result as a PDF (pdf-lib, no React on the
 * server). Branded with the org name and SelectIQ blue.
 *
 * `includeProctoring` is decided by the route: managers see the integrity
 * summary; a candidate downloading their own report does not.
 *
 * The standard Helvetica font only encodes WinAnsi (Latin-1 + a few
 * typographic extras). `safe()` maps anything else — e.g. a name in
 * Devanagari — to "?" instead of letting pdf-lib throw mid-render.
 */

const BLUE = rgb(0.145, 0.388, 0.922) // #2563eb
const INK = rgb(0.059, 0.09, 0.165) // #0f172a
const MUTED = rgb(0.392, 0.455, 0.545) // #64748b
const RULE = rgb(0.886, 0.91, 0.941) // #e2e8f0
const TINT = rgb(0.937, 0.957, 0.984) // #eff4fb

const A4 = { w: 595.28, h: 841.89 }
const M = 48

const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
function safe(text: string | null | undefined): string {
  let out = ''
  for (const ch of text ?? '') {
    const c = ch.codePointAt(0)!
    if (c === 9) out += ' '
    else if ((c >= 32 && c < 127) || (c >= 160 && c <= 255) || WINANSI_EXTRA.has(ch)) out += ch
    else if (c === 10 || c === 13) out += ' '
    else out += '?'
  }
  return out
}

const TZ = 'Asia/Kolkata'
const ist = (d: Date | null | undefined) =>
  d
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(d)
    : '—'
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

/** Load everything the report shows. Throws NotFound if no result exists. */
export async function getReportData(userId: string, assessmentId: string) {
  const result = await prisma.result.findFirst({
    where: { userId, assessmentId },
    select: {
      status: true,
      totalScore: true,
      maxScore: true,
      percentage: true,
      passed: true,
      attemptId: true,
      user: { select: { name: true, email: true, phone: true } },
      attempt: { select: { startedAt: true, submittedAt: true } },
      assessment: {
        select: {
          title: true,
          orgId: true,
          passingScore: true,
          org: { select: { name: true } },
          sections: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              questions: {
                orderBy: { order: 'asc' },
                select: { questionId: true, question: { select: { title: true, type: true } } },
              },
            },
          },
        },
      },
      questionResults: {
        select: { questionId: true, scoreAwarded: true, maxMarks: true, isCorrect: true, needsReview: true, feedback: true },
      },
    },
  })
  if (!result) throw new NotFoundError('Result not found')
  return result
}

type ReportData = Awaited<ReturnType<typeof getReportData>>

export async function renderCandidateReport(
  data: ReportData,
  opts: { includeProctoring: boolean },
): Promise<{ filename: string; body: Uint8Array }> {
  // A name the standard font can't draw (e.g. Devanagari) would print as
  // "??? ?????". Fall back to the email rather than show that.
  const displayName =
    data.user.name && !safe(data.user.name).includes('?')
      ? data.user.name
      : (data.user.email ?? data.user.phone ?? 'Candidate')
  const pdf = await PDFDocument.create()
  pdf.setTitle(safe(`${data.assessment.title} — ${displayName}`))
  pdf.setProducer('SelectIQ')
  pdf.setCreator('SelectIQ')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page!: PDFPage
  let y = 0
  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h])
    y = A4.h - M
    // Brand strip
    page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: BLUE })
    page.drawText('SelectIQ', { x: M, y: A4.h - 32, size: 11, font: bold, color: BLUE })
    const org = safe(data.assessment.org.name)
    page.drawText(org, {
      x: A4.w - M - font.widthOfTextAtSize(org, 9),
      y: A4.h - 31,
      size: 9,
      font,
      color: MUTED,
    })
    y = A4.h - 58
  }
  const ensure = (h: number) => {
    if (y - h < M + 20) newPage()
  }
  const text = (s: string, x: number, size: number, f: PDFFont = font, color = INK) =>
    page.drawText(safe(s), { x, y, size, font: f, color })
  /** Greedy word wrap; returns lines no wider than `width`. */
  const wrap = (s: string, size: number, width: number, f: PDFFont = font, maxLines = 50) => {
    const words = safe(s).split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let line = ''
    let consumed = 0
    for (const w of words) {
      const next = line ? `${line} ${w}` : w
      if (f.widthOfTextAtSize(next, size) <= width) {
        line = next
        consumed += 1
        continue
      }
      if (line) lines.push(line)
      if (lines.length >= maxLines) {
        line = ''
        break
      }
      line = w
      consumed += 1
      while (f.widthOfTextAtSize(line, size) > width && line.length > 1) line = line.slice(0, -1)
    }
    if (line && lines.length < maxLines) lines.push(line)
    // Ellipsis only when words were actually dropped.
    if (consumed < words.length && lines.length > 0) {
      let last = lines[lines.length - 1]!
      while (last.length > 1 && f.widthOfTextAtSize(`${last}...`, size) > width) last = last.slice(0, -1)
      lines[lines.length - 1] = `${last.trimEnd()}...`
    }
    return lines
  }
  const heading = (label: string) => {
    ensure(34)
    y -= 18
    text(label.toUpperCase(), M, 8.5, bold, MUTED)
    y -= 8
    page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.6, color: RULE })
    y -= 14
  }

  newPage()

  // Title + candidate
  for (const l of wrap(data.assessment.title, 18, A4.w - 2 * M, bold, 2)) {
    text(l, M, 18, bold)
    y -= 22
  }
  text(
    [displayName, data.user.email, data.user.phone]
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .join('  ·  '),
    M,
    10,
    font,
    MUTED,
  )
  y -= 16
  const minutes =
    data.attempt?.submittedAt && data.attempt.startedAt
      ? Math.round((data.attempt.submittedAt.getTime() - data.attempt.startedAt.getTime()) / 6000) / 10
      : null
  text(
    `Submitted ${ist(data.attempt?.submittedAt)}${minutes !== null ? `  ·  ${minutes} min taken` : ''}`,
    M,
    10,
    font,
    MUTED,
  )
  y -= 22

  // Summary tiles
  const graded = data.status === 'GRADED'
  const outcome = !graded
    ? 'Awaiting review'
    : data.passed === true
      ? 'Passed'
      : data.passed === false
        ? 'Not passed'
        : 'Graded'
  const tiles: [string, string][] = [
    ['Score', `${fmt(data.totalScore)} / ${fmt(data.maxScore)}`],
    ['Percentage', graded ? `${data.percentage.toFixed(1)}%` : '—'],
    ['Outcome', outcome],
    ['Pass mark', data.assessment.passingScore !== null ? fmt(data.assessment.passingScore) : 'Not set'],
  ]
  const gap = 10
  const tw = (A4.w - 2 * M - gap * 3) / 4
  const th = 52
  ensure(th + 10)
  tiles.forEach(([k, v], i) => {
    const x = M + i * (tw + gap)
    page.drawRectangle({ x, y: y - th, width: tw, height: th, color: TINT, borderColor: RULE, borderWidth: 0.6 })
    page.drawText(safe(k), { x: x + 10, y: y - 18, size: 8.5, font, color: MUTED })
    page.drawText(safe(v), { x: x + 10, y: y - 38, size: 14, font: bold, color: i === 2 && data.passed === false ? rgb(0.86, 0.15, 0.15) : INK })
  })
  y -= th + 8
  if (!graded) {
    y -= 10
    text('Some answers are still being reviewed. The final score may change.', M, 9, font, MUTED)
    y -= 4
  }

  // Sections
  const qrById = new Map(data.questionResults.map((q) => [q.questionId, q]))
  heading('Sections')
  for (const s of data.assessment.sections) {
    let got = 0
    let max = 0
    for (const q of s.questions) {
      const qr = qrById.get(q.questionId)
      if (!qr) continue
      got += qr.scoreAwarded
      max += qr.maxMarks
    }
    const pct = max > 0 ? Math.max(0, got / max) : 0
    ensure(22)
    text(s.title, M, 10, font)
    const val = `${fmt(got)} / ${fmt(max)}`
    page.drawText(safe(val), { x: A4.w - M - bold.widthOfTextAtSize(val, 10), y, size: 10, font: bold, color: INK })
    // bar
    const bx = M + 230
    const bw = A4.w - M - 70 - bx
    page.drawRectangle({ x: bx, y: y + 1, width: bw, height: 6, color: RULE })
    page.drawRectangle({ x: bx, y: y + 1, width: bw * pct, height: 6, color: BLUE })
    y -= 20
  }

  // Questions table
  heading('Question breakdown')
  const cols = { n: M, q: M + 24, type: M + 330, marks: A4.w - M - 110, status: A4.w - M - 64 }
  const headerRow = () => {
    ensure(20)
    text('#', cols.n, 8.5, bold, MUTED)
    text('Question', cols.q, 8.5, bold, MUTED)
    text('Type', cols.type, 8.5, bold, MUTED)
    text('Marks', cols.marks, 8.5, bold, MUTED)
    text('Result', cols.status, 8.5, bold, MUTED)
    y -= 14
  }
  headerRow()
  let n = 0
  for (const s of data.assessment.sections) {
    for (const q of s.questions) {
      n += 1
      const qr = qrById.get(q.questionId)
      const lines = wrap(q.question.title, 9.5, cols.type - cols.q - 10, font, 2)
      const rowH = 12 * lines.length + 8
      if (y - rowH < M + 20) {
        newPage()
        headerRow()
      }
      const status = !qr
        ? '—'
        : qr.needsReview
          ? 'Pending'
          : qr.isCorrect === true
            ? 'Correct'
            : qr.isCorrect === false
              ? 'Incorrect'
              : 'Partial'
      text(String(n), cols.n, 9.5, font, MUTED)
      lines.forEach((l, i) => page.drawText(l, { x: cols.q, y: y - i * 12, size: 9.5, font, color: INK }))
      text(labelOf(QUESTION_TYPE_LABEL, q.question.type), cols.type, 9, font, MUTED)
      text(qr ? `${fmt(qr.scoreAwarded)}/${fmt(qr.maxMarks)}` : '—', cols.marks, 9.5, bold)
      text(status, cols.status, 9, font, status === 'Incorrect' ? rgb(0.86, 0.15, 0.15) : status === 'Correct' ? rgb(0.02, 0.59, 0.41) : MUTED)
      y -= rowH
      // Divider sits in the gap between this row's descenders and the next
      // row's cap height (next baseline + 12), so it never crosses text.
      page.drawLine({ start: { x: M, y: y + 12 }, end: { x: A4.w - M, y: y + 12 }, thickness: 0.4, color: RULE })
    }
  }

  // Reviewer feedback
  const withFeedback = data.assessment.sections
    .flatMap((s) => s.questions)
    .map((q, i) => ({ i: i + 1, title: q.question.title, fb: qrById.get(q.questionId)?.feedback }))
    .filter((x) => x.fb)
  if (withFeedback.length) {
    heading('Reviewer feedback')
    for (const f of withFeedback) {
      const lines = wrap(f.fb!, 9.5, A4.w - 2 * M - 12, font, 12)
      ensure(16 + lines.length * 12)
      text(`Q${f.i}. ${wrap(f.title, 9.5, A4.w - 2 * M, bold, 1)[0] ?? ''}`, M, 9.5, bold)
      y -= 13
      for (const l of lines) {
        text(l, M + 12, 9.5, font, MUTED)
        y -= 12
      }
      y -= 6
    }
  }

  // Proctoring (managers only)
  if (opts.includeProctoring) {
    const flags = await prisma.proctoringFlag.groupBy({
      by: ['type', 'severity'],
      where: { session: { attemptId: data.attemptId } },
      _count: { _all: true },
    })
    heading('Proctoring')
    if (flags.length === 0) {
      ensure(14)
      text('No proctoring flags were raised.', M, 9.5, font, MUTED)
      y -= 14
    } else {
      for (const f of flags.sort((a, b) => b._count._all - a._count._all)) {
        ensure(14)
        text(`${f.type.replace(/_/g, ' ').toLowerCase()}  (${f.severity.toLowerCase()})`, M, 9.5)
        const c = String(f._count._all)
        page.drawText(c, { x: A4.w - M - bold.widthOfTextAtSize(c, 9.5), y, size: 9.5, font: bold, color: INK })
        y -= 14
      }
    }
  }

  // Footer on every page
  const pages = pdf.getPages()
  const stamp = `Generated ${ist(new Date())} IST`
  pages.forEach((p, i) => {
    p.drawText(safe(stamp), { x: M, y: 24, size: 8, font, color: MUTED })
    const pg = `Page ${i + 1} of ${pages.length}`
    p.drawText(pg, { x: A4.w - M - font.widthOfTextAtSize(pg, 8), y: 24, size: 8, font, color: MUTED })
  })

  return {
    filename: `${data.assessment.title} - ${data.user.name ?? data.user.email ?? 'candidate'}.pdf`,
    body: await pdf.save(),
  }
}

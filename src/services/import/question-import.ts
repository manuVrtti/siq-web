import 'server-only'

import { prisma } from '@/lib/prisma'
import { buildWorkbook, parseSheet, type SheetRow } from '@/lib/import/xlsx-parser'
import { DIFFICULTIES, QUESTION_TYPES, questionInputSchema, type QuestionInput } from '@/lib/validators/question'

/**
 * Plan 020 — question bank import: template → validate (dry run) → commit.
 *
 * Every row is converted to the same QuestionInput the question form sends
 * and checked with the SAME questionInputSchema, so an imported question
 * obeys identical rules (one correct answer for single choice, two options
 * for true/false, …). Commit re-parses and re-validates the uploaded file —
 * the client's preview is never trusted as input.
 */

const OPTION_KEYS = ['optiona', 'optionb', 'optionc', 'optiond', 'optione', 'optionf'] as const
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

const TYPE_ALIASES: Record<string, (typeof QUESTION_TYPES)[number]> = {
  mcq: 'MCQ_SINGLE',
  mcqsingle: 'MCQ_SINGLE',
  single: 'MCQ_SINGLE',
  singlechoice: 'MCQ_SINGLE',
  mcqmulti: 'MCQ_MULTI',
  multi: 'MCQ_MULTI',
  multiple: 'MCQ_MULTI',
  multiplechoice: 'MCQ_MULTI',
  multiselect: 'MCQ_MULTI',
  truefalse: 'TRUE_FALSE',
  tf: 'TRUE_FALSE',
  subjective: 'SUBJECTIVE',
  descriptive: 'SUBJECTIVE',
  coding: 'CODING',
  code: 'CODING',
}

export const QUESTION_REQUIRED_HEADERS = ['type', 'title', 'body', 'marks']

export type QuestionRowResult =
  | {
      rowNumber: number
      ok: true
      title: string
      type: string
      input: QuestionInput
      tagNames: string[]
      /** Plan 026 — raw topic / skills cells; resolved against the taxonomy in validateQuestionImport. */
      topicRaw: string
      skillRaws: string[]
      topicId?: string
      skillIds?: string[]
    }
  | { rowNumber: number; ok: false; title: string; errors: string[] }

export function getQuestionTemplate(): Buffer {
  const header = {
    type: '',
    title: '',
    body: '',
    difficulty: '',
    marks: '',
    negative_marks: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    option_e: '',
    option_f: '',
    correct: '',
    tags: '',
    topic: '',
    skills: '',
    explanation: '',
  }
  return buildWorkbook([
    {
      name: 'Questions',
      widths: [12, 36, 60, 11, 7, 14, 22, 22, 22, 22, 16, 16, 9, 24, 10, 28, 40],
      rows: [
        {
          ...header,
          type: 'MCQ_SINGLE',
          title: 'Time complexity of binary search',
          body: 'What is the worst-case time complexity of binary search on a sorted array of n elements?',
          difficulty: 'EASY',
          marks: 1,
          negative_marks: 0.25,
          option_a: 'O(n)',
          option_b: 'O(log n)',
          option_c: 'O(n log n)',
          option_d: 'O(1)',
          correct: 'B',
          tags: 'DSA, Searching',
          topic: 'DSA',
          skills: 'Binary search',
          explanation: 'The search space halves each step.',
        },
        {
          ...header,
          type: 'MCQ_MULTI',
          title: 'Stable sorting algorithms',
          body: 'Which of these sorting algorithms are stable?',
          difficulty: 'MEDIUM',
          marks: 2,
          option_a: 'Merge sort',
          option_b: 'Quick sort',
          option_c: 'Insertion sort',
          option_d: 'Heap sort',
          correct: 'A, C',
          tags: 'DSA, Sorting',
          topic: 'DSA',
          skills: 'Sorting & Searching',
        },
        {
          ...header,
          type: 'TRUE_FALSE',
          title: 'HTTP is stateless',
          body: 'HTTP is a stateless protocol.',
          marks: 1,
          correct: 'True',
          tags: 'Networking',
          topic: 'CN',
          skills: 'HTTP & DNS',
        },
        {
          ...header,
          type: 'SUBJECTIVE',
          title: 'Explain normalization',
          body: 'Explain 1NF, 2NF and 3NF with an example.',
          difficulty: 'HARD',
          marks: 5,
          tags: 'DBMS',
          topic: 'DBMS',
          skills: 'Normalization',
        },
      ],
    },
    {
      name: 'Instructions',
      widths: [18, 100],
      rows: [
        { column: 'type', rule: 'MCQ_SINGLE, MCQ_MULTI, TRUE_FALSE, SUBJECTIVE or CODING (also accepts "mcq", "multi", "tf").' },
        { column: 'title', rule: 'Short label shown in the bank. Required, max 300 characters. Titles already in your bank are skipped.' },
        { column: 'body', rule: 'The full question text. Required.' },
        { column: 'difficulty', rule: 'EASY, MEDIUM or HARD. Defaults to MEDIUM.' },
        { column: 'marks', rule: 'Whole number, at least 1.' },
        { column: 'negative_marks', rule: 'Marks deducted for a wrong answer (only under negative-marking assessments). Defaults to 0.' },
        { column: 'option_a … option_f', rule: 'Answer choices for MCQ questions. Leave blank for SUBJECTIVE / CODING. TRUE_FALSE fills True / False automatically.' },
        { column: 'correct', rule: 'Letter(s) of the correct option: "B", or "A, C" for multi-select. For TRUE_FALSE you may write True or False.' },
        { column: 'tags', rule: 'Comma-separated tag names. Missing tags are created.' },
        { column: 'topic', rule: 'What the question measures, by code or name: DSA, DBMS, OS, CN, OOP, APT, LR, VERBAL, CODING, or one of your college’s own topics. Leave blank to tag it later (Question bank → Tag questions).' },
        { column: 'skills', rule: 'Comma-separated skills under that topic, by name or common spelling ("dp", "Dynamic Programming"). Required when a topic is given. See Question bank → Topics & skills for the full list.' },
        { column: 'explanation', rule: 'Optional. Shown to reviewers.' },
        { column: 'Limits', rule: 'Up to 2,000 rows and 5 MB per file. Only the first sheet is read.' },
      ],
    },
  ])
}

function rowToInput(row: SheetRow): QuestionRowResult {
  const v = row.values
  const title = v.title ?? ''
  const errors: string[] = []

  const type = TYPE_ALIASES[(v.type ?? '').toLowerCase().replace(/[^a-z]/g, '')] ??
    QUESTION_TYPES.find((t) => t === (v.type ?? '').toUpperCase())
  if (!type) errors.push(`Unknown type "${v.type ?? ''}"`)

  const difficultyRaw = (v.difficulty ?? '').toUpperCase()
  const difficulty = difficultyRaw
    ? DIFFICULTIES.find((d) => d === difficultyRaw)
    : 'MEDIUM'
  if (!difficulty) errors.push(`Difficulty must be EASY, MEDIUM or HARD (got "${v.difficulty}")`)

  const marks = Number(v.marks)
  const negativeMarks = v.negativemarks ? Number(v.negativemarks) : 0
  if (v.negativemarks && !Number.isFinite(negativeMarks)) errors.push('negative_marks must be a number')

  // Options: explicit columns, or True/False defaults.
  let optionTexts = OPTION_KEYS.map((k) => v[k] ?? '').filter(Boolean)
  if (type === 'TRUE_FALSE' && optionTexts.length === 0) optionTexts = ['True', 'False']

  // Correct: letters, or the literal option text for true/false.
  const correctRaw = (v.correct ?? '').trim()
  const correctIdx = new Set<number>()
  for (const tok of correctRaw.split(/[,;/\s]+/).filter(Boolean)) {
    const letter = LETTERS.indexOf(tok.toUpperCase() as (typeof LETTERS)[number])
    if (letter >= 0) {
      correctIdx.add(letter)
      continue
    }
    const byText = optionTexts.findIndex((o) => o.toLowerCase() === tok.toLowerCase())
    if (byText >= 0) correctIdx.add(byText)
    else errors.push(`"correct" value "${tok}" doesn't match an option letter`)
  }
  for (const i of correctIdx) {
    if (i >= optionTexts.length) errors.push(`"correct" points at option ${LETTERS[i]}, which is empty`)
  }

  const tagNames = [...new Set((v.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean))]
  if (tagNames.some((t) => t.length > 60)) errors.push('Tag names must be 60 characters or fewer')

  const candidate = {
    type,
    title,
    body: v.body ?? '',
    difficulty: difficulty ?? 'MEDIUM',
    marks,
    negativeMarks,
    explanation: v.explanation || undefined,
    tagIds: [],
    options: optionTexts.map((text, i) => ({ text, isCorrect: correctIdx.has(i), order: i })),
  }
  const parsed = questionInputSchema.safeParse(candidate)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      // Already reported in plain words above.
      if (!type && issue.path[0] === 'type') continue
      const field = issue.path[0] ? `${String(issue.path[0])}: ` : ''
      errors.push(`${field}${issue.message}`)
    }
  }

  if (errors.length > 0 || !parsed.success) {
    return { rowNumber: row.rowNumber, ok: false, title, errors: [...new Set(errors)] }
  }
  const topicRaw = (v.topic ?? '').trim()
  const skillRaws = [...new Set((v.skills ?? '').split(',').map((t) => t.trim()).filter(Boolean))]
  if (!topicRaw && skillRaws.length > 0) {
    return { rowNumber: row.rowNumber, ok: false, title, errors: ['Skills need a topic — fill in the topic column'] }
  }
  return { rowNumber: row.rowNumber, ok: true, title, type: parsed.data.type, input: parsed.data, tagNames, topicRaw, skillRaws }
}

/**
 * Dry run. Row-level rule checks, then two set-level checks: a title that
 * repeats earlier in the file, and a title already in this org's bank
 * (prevents a re-upload from duplicating the whole bank).
 */
export async function validateQuestionImport(orgId: string, bytes: ArrayBuffer | Buffer) {
  const { rows } = parseSheet(bytes, { requiredHeaders: QUESTION_REQUIRED_HEADERS })
  const results = rows.map(rowToInput)

  const existing = await prisma.question.findMany({
    where: { orgId, title: { in: [...new Set(results.map((r) => r.title.trim()).filter(Boolean))], mode: 'insensitive' } },
    select: { title: true },
  })
  const existingSet = new Set(existing.map((e) => e.title.trim().toLowerCase()))
  const seen = new Set<string>()
  const taxonomy = await prisma.topicSection.findMany({
    where: { OR: [{ orgId: null }, { orgId }] },
    select: { id: true, code: true, name: true, skills: { where: { OR: [{ orgId: null }, { orgId }] }, select: { id: true, name: true, aliases: true } } },
  })
  const topicByKey = new Map<string, (typeof taxonomy)[number]>()
  for (const t of taxonomy) {
    topicByKey.set(t.code.toLowerCase(), t)
    topicByKey.set(t.name.toLowerCase(), t)
  }

  const checked: QuestionRowResult[] = results.map((r) => {
    const key = r.title.trim().toLowerCase()
    const extra: string[] = []
    if (key && existingSet.has(key)) extra.push('A question with this title is already in your bank')
    if (key && seen.has(key)) extra.push('Duplicate title earlier in this file')
    if (key) seen.add(key)
    // Plan 026 — topic + skills must exist in this college's taxonomy.
    let resolved: { topicId?: string; skillIds?: string[] } = {}
    if (r.ok && r.topicRaw) {
      const topic = topicByKey.get(r.topicRaw.toLowerCase())
      if (!topic) extra.push(`Unknown topic "${r.topicRaw}" — see Question bank → Topics & skills`)
      else if (r.skillRaws.length === 0) extra.push(`List at least one ${topic.code} skill in the skills column`)
      else {
        const ids: string[] = []
        for (const raw of r.skillRaws) {
          const k = raw.toLowerCase()
          const skill = topic.skills.find((s) => s.name.toLowerCase() === k || s.aliases.includes(k))
          if (skill) ids.push(skill.id)
          else extra.push(`"${raw}" isn’t a ${topic.code} skill`)
        }
        resolved = { topicId: topic.id, skillIds: [...new Set(ids)] }
      }
    }
    if (extra.length === 0) return r.ok ? { ...r, ...resolved } : r
    return {
      rowNumber: r.rowNumber,
      ok: false as const,
      title: r.title,
      errors: [...(r.ok ? [] : r.errors), ...extra],
    }
  })

  const validRows = checked.filter((r): r is Extract<QuestionRowResult, { ok: true }> => r.ok)
  // Case-insensitive dedupe ("DSA" and "dsa" are one tag); first spelling wins.
  const tagByLower = new Map<string, string>()
  for (const t of validRows.flatMap((r) => r.tagNames)) {
    if (!tagByLower.has(t.toLowerCase())) tagByLower.set(t.toLowerCase(), t)
  }
  const allTags = [...tagByLower.values()]
  const existingTags = allTags.length
    ? await prisma.tag.findMany({
        where: { orgId, name: { in: allTags, mode: 'insensitive' } },
        select: { name: true },
      })
    : []
  const existingTagSet = new Set(existingTags.map((t) => t.name.toLowerCase()))

  return {
    rows: checked,
    summary: {
      total: checked.length,
      valid: validRows.length,
      invalid: checked.length - validRows.length,
      newTags: allTags.filter((t) => !existingTagSet.has(t.toLowerCase())),
      /** Plan 026 — valid rows that arrive with a topic + skills (the rest go to the tagging queue). */
      tagged: validRows.filter((r) => r.topicId).length,
    },
  }
}

/**
 * Commit: re-validate, create missing tags, then insert every valid question.
 * One transaction per question (nested options + tags), sequential in chunks
 * of 25 so a 1,000-row import neither holds one giant transaction nor opens
 * 1,000 connections at once. Returns what was created.
 */
export async function commitQuestionImport(orgId: string, userId: string, bytes: ArrayBuffer | Buffer) {
  const { rows, summary } = await validateQuestionImport(orgId, bytes)
  const valid = rows.filter((r): r is Extract<QuestionRowResult, { ok: true }> => r.ok)

  // Tags: resolve case-insensitively, create what's missing.
  const tagNames = [...new Set(valid.flatMap((r) => r.tagNames))]
  if (summary.newTags.length) {
    await prisma.tag.createMany({
      data: summary.newTags.map((name) => ({ orgId, name })),
      skipDuplicates: true,
    })
  }
  const tags = tagNames.length
    ? await prisma.tag.findMany({
        where: { orgId, name: { in: tagNames, mode: 'insensitive' } },
        select: { id: true, name: true },
      })
    : []
  const tagIdByName = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]))

  let created = 0
  for (let i = 0; i < valid.length; i += 25) {
    const chunk = valid.slice(i, i + 25)
    await Promise.all(
      chunk.map((r) =>
        prisma.question.create({
          data: {
            orgId,
            createdById: userId,
            type: r.input.type,
            title: r.input.title,
            body: r.input.body,
            difficulty: r.input.difficulty,
            marks: r.input.marks,
            negativeMarks: r.input.negativeMarks,
            explanation: r.input.explanation ?? null,
            options: { create: r.input.options },
            ...(r.topicId && r.skillIds?.length
              ? { topic: { create: { sectionId: r.topicId } }, skills: { create: r.skillIds.map((skillId) => ({ skillId })) } }
              : {}),
            tags: {
              create: r.tagNames
                .map((n) => tagIdByName.get(n.toLowerCase()))
                .filter((id): id is string => Boolean(id))
                .map((tagId) => ({ tagId })),
            },
          },
          select: { id: true },
        }),
      ),
    )
    created += chunk.length
  }

  return { created, skipped: summary.invalid, newTags: summary.newTags.length, tagged: summary.tagged }
}

import 'server-only'

import type { Prisma } from '@prisma/client'

import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { assertCollegeAdminOf } from '@/services/people'
import type { CurrentUser } from '@/types/auth'

/**
 * Plan 021 — two-axis taxonomy: Topic (coarse, e.g. DSA) → Skill (fine,
 * e.g. Dynamic Programming). Every analytics-ready question has exactly one
 * topic and at least one skill under it.
 *
 *   Platform spine (orgId null) — shared by every college so a "DSA" score
 *     means the same thing everywhere. Only Super Admins change it.
 *   College additions (orgId set) — a College Admin's own topics, or extra
 *     skills under a platform topic. Visible only inside that college.
 *
 * A college sees: platform + its own. It can never see or use another
 * college's additions.
 */

/** Taxonomy rows a college may see and use. */
export function visibleTo(orgId: string) {
  return { OR: [{ orgId: null }, { orgId }] } satisfies Prisma.TopicSectionWhereInput & Prisma.SkillNodeWhereInput
}

const codeOf = (raw: string) =>
  raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)

/** Topics (+ skills) visible to a college, platform first, with usage counts. */
export async function listTaxonomy(orgId: string) {
  const topics = await prisma.topicSection.findMany({
    where: visibleTo(orgId),
    orderBy: [{ orgId: { sort: 'asc', nulls: 'first' } }, { order: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      orgId: true,
      name: true,
      code: true,
      description: true,
      skills: {
        where: visibleTo(orgId),
        orderBy: { name: 'asc' },
        select: { id: true, orgId: true, name: true, code: true, aliases: true, _count: { select: { questions: { where: { question: { orgId } } } } } },
      },
      _count: { select: { questions: { where: { question: { orgId } } } } },
    },
  })
  return topics.map((t) => ({
    ...t,
    platform: t.orgId === null,
    questions: t._count.questions,
    skills: t.skills.map((s) => ({ ...s, platform: s.orgId === null, questions: s._count.questions })),
  }))
}

/** The platform spine only (Super Admin console). */
export async function listPlatformTaxonomy() {
  return prisma.topicSection.findMany({
    where: { orgId: null },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      skills: { where: { orgId: null }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true, aliases: true, _count: { select: { questions: true } } } },
      _count: { select: { questions: true } },
    },
  })
}

/* ---- who may change what ---------------------------------------------- */

async function assertCanEdit(actor: CurrentUser, orgId: string | null) {
  if (orgId === null) {
    if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenError('Only a Super Admin can change the platform topics')
    return
  }
  await assertCollegeAdminOf(actor, orgId)
}

/* ---- topics ------------------------------------------------------------- */

export async function createTopic(actor: CurrentUser, orgId: string | null, input: { name: string; code?: string; description?: string | null }) {
  await assertCanEdit(actor, orgId)
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80) throw new ValidationError('Topic name must be 2–80 characters')
  const code = codeOf(input.code || name)
  if (code.length < 2) throw new ValidationError('Give the topic a short code, e.g. DSA')
  // Codes must not collide with the platform spine or within the same college.
  const clash = await prisma.topicSection.findFirst({ where: { code, OR: [{ orgId: null }, { orgId }] }, select: { id: true } })
  if (clash) throw new ValidationError(`A topic with the code ${code} already exists`)
  const order = await prisma.topicSection.count({ where: { orgId } })
  return prisma.topicSection.create({ data: { orgId, name, code, description: input.description?.trim() || null, order } })
}

async function getTopicForEdit(actor: CurrentUser, id: string) {
  const t = await prisma.topicSection.findUnique({ where: { id }, select: { id: true, orgId: true } })
  if (!t) throw new NotFoundError('Topic not found')
  await assertCanEdit(actor, t.orgId)
  return t
}

export async function updateTopic(actor: CurrentUser, id: string, input: { name?: string; description?: string | null }) {
  await getTopicForEdit(actor, id)
  const data: Prisma.TopicSectionUpdateInput = {}
  if (input.name !== undefined) {
    const n = input.name.trim().replace(/\s+/g, ' ')
    if (n.length < 2 || n.length > 80) throw new ValidationError('Topic name must be 2–80 characters')
    data.name = n
  }
  if (input.description !== undefined) data.description = input.description?.trim() || null
  return prisma.topicSection.update({ where: { id }, data })
}

/** Only an unused topic can be deleted — tagged questions keep their meaning. */
export async function deleteTopic(actor: CurrentUser, id: string) {
  await getTopicForEdit(actor, id)
  const used = await prisma.questionTopic.count({ where: { sectionId: id } })
  const usedSkills = await prisma.questionSkill.count({ where: { skill: { sectionId: id } } })
  if (used || usedSkills) throw new ValidationError(`This topic is used by ${used || usedSkills} question(s) — retag them first`)
  await prisma.topicSection.delete({ where: { id } })
}

/* ---- skills ------------------------------------------------------------- */

/**
 * Add a skill. Platform skills (orgId null) only under a platform topic, by a
 * Super Admin. A college may add its own skills under a platform topic or
 * under one of its own topics.
 */
export async function createSkill(
  actor: CurrentUser,
  orgId: string | null,
  input: { sectionId: string; name: string; aliases?: string[] },
) {
  await assertCanEdit(actor, orgId)
  const topic = await prisma.topicSection.findUnique({ where: { id: input.sectionId }, select: { id: true, orgId: true, code: true } })
  if (!topic) throw new NotFoundError('Topic not found')
  if (orgId === null && topic.orgId !== null) throw new ValidationError('Platform skills belong under platform topics')
  if (orgId !== null && topic.orgId !== null && topic.orgId !== orgId) throw new NotFoundError('Topic not found')
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80) throw new ValidationError('Skill name must be 2–80 characters')
  const code = `${topic.code}.${codeOf(name)}`
  const clash = await prisma.skillNode.findFirst({
    where: { sectionId: topic.id, OR: [{ code }, { name: { equals: name, mode: 'insensitive' } }], AND: [visibleTo(orgId ?? '__platform__')] },
    select: { id: true },
  })
  if (clash) throw new ValidationError('That skill already exists under this topic')
  const aliases = [...new Set([name, ...(input.aliases ?? [])].map((a) => a.trim().toLowerCase()).filter(Boolean))].slice(0, 20)
  return prisma.skillNode.create({ data: { orgId, sectionId: topic.id, name, code, aliases } })
}

export async function updateSkill(actor: CurrentUser, id: string, input: { name?: string; aliases?: string[] }) {
  const s = await prisma.skillNode.findUnique({ where: { id }, select: { orgId: true, name: true } })
  if (!s) throw new NotFoundError('Skill not found')
  await assertCanEdit(actor, s.orgId)
  const data: Prisma.SkillNodeUpdateInput = {}
  if (input.name !== undefined) {
    const n = input.name.trim().replace(/\s+/g, ' ')
    if (n.length < 2 || n.length > 80) throw new ValidationError('Skill name must be 2–80 characters')
    data.name = n
  }
  if (input.aliases !== undefined) {
    data.aliases = [...new Set([String(data.name ?? s.name), ...input.aliases].map((a) => a.trim().toLowerCase()).filter(Boolean))].slice(0, 20)
  }
  return prisma.skillNode.update({ where: { id }, data })
}

export async function deleteSkill(actor: CurrentUser, id: string) {
  const s = await prisma.skillNode.findUnique({ where: { id }, select: { orgId: true } })
  if (!s) throw new NotFoundError('Skill not found')
  await assertCanEdit(actor, s.orgId)
  const used = await prisma.questionSkill.count({ where: { skillId: id } })
  if (used) throw new ValidationError(`This skill is used by ${used} question(s) — retag them first`)
  await prisma.skillNode.delete({ where: { id } })
}

/**
 * "dp", "Dynamic programming", "DP " → the canonical Dynamic Programming
 * skill visible to this college (optionally within one topic).
 */
export async function normalizeSkill(raw: string, orgId: string, sectionId?: string) {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  return prisma.skillNode.findFirst({
    where: {
      ...visibleTo(orgId),
      ...(sectionId && { sectionId }),
      AND: [{ OR: [{ aliases: { has: v } }, { name: { equals: raw.trim(), mode: 'insensitive' } }] }],
    },
    select: { id: true, name: true, sectionId: true },
  })
}

/* ---- question tagging --------------------------------------------------- */

/**
 * Validate a (topic, skills) pair for a question in this college: the topic
 * and every skill must be visible to the college, every skill must belong to
 * the topic, and there must be at least one skill.
 */
export async function validateTagging(orgId: string, sectionId: string, rawSkillIds: string[]) {
  const skillIds = [...new Set(rawSkillIds)]
  if (skillIds.length === 0) throw new ValidationError('Pick at least one skill for the topic')
  if (skillIds.length > 15) throw new ValidationError('At most 15 skills per question')
  const topic = await prisma.topicSection.findFirst({ where: { id: sectionId, ...visibleTo(orgId) }, select: { id: true } })
  if (!topic) throw new ValidationError('Choose a topic from this college’s list')
  const ok = await prisma.skillNode.count({ where: { id: { in: skillIds }, sectionId, ...visibleTo(orgId) } })
  if (ok !== skillIds.length) throw new ValidationError('Every skill must belong to the chosen topic')
  return skillIds
}

/** Set (replace) a question's topic + skills. Caller has checked org access. */
export async function setQuestionTagging(
  tx: Prisma.TransactionClient,
  questionId: string,
  sectionId: string | null,
  skillIds: string[],
) {
  await tx.questionSkill.deleteMany({ where: { questionId } })
  await tx.questionTopic.deleteMany({ where: { questionId } })
  if (!sectionId) return
  await tx.questionTopic.create({ data: { questionId, sectionId } })
  await tx.questionSkill.createMany({ data: skillIds.map((skillId) => ({ questionId, skillId })) })
}

/** Untagged = no topic, or a topic with no skill. */
export const untaggedWhere = { OR: [{ topic: { is: null } }, { skills: { none: {} } }] } satisfies Prisma.QuestionWhereInput

export async function isDiagnosticReady(questionId: string) {
  const q = await prisma.question.findUnique({
    where: { id: questionId },
    select: { topic: { select: { sectionId: true } }, _count: { select: { skills: true } } },
  })
  return Boolean(q?.topic && q._count.skills > 0)
}

export async function bulkTag(orgId: string, questionIds: string[], sectionId: string, skillIds: string[]) {
  const ids = [...new Set(questionIds)].slice(0, 200)
  if (!ids.length) return 0
  const skills = await validateTagging(orgId, sectionId, skillIds)
  const owned = await prisma.question.count({ where: { id: { in: ids }, orgId } })
  if (owned !== ids.length) throw new NotFoundError('One or more questions are not in this college')
  await prisma.$transaction(async (tx) => {
    for (const id of ids) await setQuestionTagging(tx, id, sectionId, skills)
  })
  return ids.length
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileQuestion, Network, Plus, Tags, Upload } from 'lucide-react'

import { Pill } from '@/components/dashboard/bits'
import {
  DataTable,
  Pagination,
  SortHeader,
  TD,
  TH,
  THead,
  TRow,
  TableEmpty,
} from '@/components/data/data-table'
import { FilterBar } from '@/components/data/filter-bar'
import { ListHeader } from '@/components/data/list-header'
import { parseTableParams, type SearchParams } from '@/components/data/table-params'
import { Button } from '@/components/ui/button'
import { DIFFICULTY_LABEL, QUESTION_TYPE_LABEL, labelOf } from '@/constants/labels'
import { prisma } from '@/lib/prisma'
import { shortDateTime } from '@/lib/format'
import { DIFFICULTIES, QUESTION_TYPES } from '@/lib/validators/question'
import { QUESTION_SORTS, listQuestions } from '@/services/questions'
import { getOrgBySlug } from '@/services/organizations'
import { listTaxonomy, untaggedWhere } from '@/services/taxonomy'
import { requirePagePermission } from '@/lib/auth/page-guard'
import { PERMISSIONS } from '@/constants/permissions'

export const metadata: Metadata = { title: 'Question bank — SelectIQ' }

const DIFFICULTY_TONE: Record<string, 'success' | 'info' | 'warning'> = {
  EASY: 'success',
  MEDIUM: 'info',
  HARD: 'warning',
}

/**
 * Plan 011, redesigned in plan 019 Phase 3 — the question bank as a real
 * table: search, filter by type / difficulty / tag, sort, page. State lives
 * in the URL so a filtered view can be bookmarked or shared.
 */
export default async function QuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<SearchParams>
}) {
  // Managers only — [org]/layout proves membership, and students are members.
  await requirePagePermission(PERMISSIONS.EDIT_ASSESSMENT)

  const { org: slug } = await params
  const org = await getOrgBySlug(slug) // access already enforced by [org]/layout
  if (!org) notFound()

  const p = parseTableParams(await searchParams, {
    sortable: QUESTION_SORTS,
    defaultSort: 'createdAt',
  })
  const type = QUESTION_TYPES.find((t) => t === p.get('type'))
  const difficulty = DIFFICULTIES.find((d) => d === p.get('difficulty'))
  const tagId = p.get('tag')
  const topicId = p.get('topic')

  const [{ items, total }, tags, bankSize, topics, untagged] = await Promise.all([
    listQuestions(org.id, {
      search: p.q || undefined,
      type,
      difficulty,
      tagId,
      topicId,
      sort: p.sort,
      dir: p.dir,
      skip: p.skip,
      take: p.pageSize,
    }),
    prisma.tag.findMany({ where: { orgId: org.id }, orderBy: { name: 'asc' } }),
    prisma.question.count({ where: { orgId: org.id } }),
    listTaxonomy(org.id),
    prisma.question.count({ where: { orgId: org.id, AND: [untaggedWhere] } }),
  ])

  const pathname = `/${slug}/questions`
  const filtered = Boolean(p.q || type || difficulty || tagId || topicId)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <ListHeader
        eyebrow={org.name}
        title="Question bank"
        description={`${bankSize.toLocaleString('en-IN')} question${bankSize === 1 ? '' : 's'} · reusable across every assessment`}
        actions={
          <>
            <Button variant="outline" render={<Link href={`${pathname}/topics`} />}>
              <Network className="size-4" aria-hidden />
              Topics &amp; skills
            </Button>
            <Button variant="outline" render={<Link href={`${pathname}/import`} />}>
              <Upload className="size-4" aria-hidden />
              Import
            </Button>
            <Button render={<Link href={`${pathname}/new`} />}>
              <Plus className="size-4" aria-hidden />
              New question
            </Button>
          </>
        }
      />

      {untagged > 0 ? (
        <Link
          href={`${pathname}/tagging`}
          className="siq-rise flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm transition-colors hover:bg-amber-500/15"
        >
          <Tags className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <span className="flex-1">
            <strong className="font-semibold">{untagged.toLocaleString('en-IN')}</strong> question
            {untagged === 1 ? ' has' : 's have'} no topic or skill yet. Tests that count toward analytics can’t
            be published with them.
          </span>
          <span className="text-primary font-medium whitespace-nowrap">Tag them →</span>
        </Link>
      ) : null}

      <FilterBar
        searchPlaceholder="Search title or body…"
        filters={[
          {
            key: 'type',
            label: 'Type',
            options: QUESTION_TYPES.map((t) => ({ value: t, label: labelOf(QUESTION_TYPE_LABEL, t) })),
          },
          {
            key: 'difficulty',
            label: 'Difficulty',
            options: DIFFICULTIES.map((d) => ({ value: d, label: labelOf(DIFFICULTY_LABEL, d) })),
          },
          {
            key: 'topic',
            label: 'Topic',
            options: [
              { value: 'untagged', label: 'Needs tagging' },
              ...topics.map((t) => ({ value: t.id, label: t.name })),
            ],
          },
          ...(tags.length > 0
            ? [{ key: 'tag', label: 'Tag', options: tags.map((t) => ({ value: t.id, label: t.name })) }]
            : []),
        ]}
      />

      {items.length === 0 ? (
        <TableEmpty
          filtered={filtered}
          clearHref={pathname}
          icon={<FileQuestion className="size-5" aria-hidden />}
          title="Your question bank is empty"
          body="Create questions once and reuse them across every assessment."
          action={
            <Button size="sm" render={<Link href={`${pathname}/new`} />}>
              Create the first question
            </Button>
          }
        />
      ) : (
        <DataTable
          minWidth={980}
          footer={<Pagination pathname={pathname} params={p} total={total} />}
        >
          <THead>
            <SortHeader label="Question" field="title" pathname={pathname} params={p} />
            <th className={TH}>Topic</th>
            <th className={TH}>Type</th>
            <SortHeader label="Difficulty" field="difficulty" pathname={pathname} params={p} />
            <SortHeader label="Marks" field="marks" pathname={pathname} params={p} align="right" />
            <th className={`${TH} text-right`}>Used in</th>
            <SortHeader label="Updated" field="updatedAt" pathname={pathname} params={p} align="right" />
          </THead>
          <tbody>
            {items.map((q) => (
              <TRow key={q.id} href={`${pathname}/${q.id}/edit`}>
                <td className={`${TD} max-w-[360px]`}>
                  <Link
                    href={`${pathname}/${q.id}/edit`}
                    className="hover:text-primary block truncate font-medium transition-colors"
                  >
                    {q.title}
                  </Link>
                  {q.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {q.tags.slice(0, 4).map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px]"
                        >
                          {tag.name}
                        </span>
                      ))}
                      {q.tags.length > 4 ? (
                        <span className="text-muted-foreground text-[11px]">+{q.tags.length - 4}</span>
                      ) : null}
                    </div>
                  ) : null}
                </td>
                <td className={`${TD} max-w-[220px]`}>
                  {q.topic && q.skills.length > 0 ? (
                    <>
                      <span className="text-xs font-medium">{q.topic.section.name}</span>
                      <span className="text-muted-foreground block truncate text-[11px]">
                        {q.skills.map((s) => s.skill.name).join(' · ')}
                      </span>
                    </>
                  ) : (
                    <Pill tone="warning">Needs tagging</Pill>
                  )}
                </td>
                <td className={`${TD} text-muted-foreground whitespace-nowrap`}>
                  {labelOf(QUESTION_TYPE_LABEL, q.type)}
                </td>
                <td className={TD}>
                  <Pill tone={DIFFICULTY_TONE[q.difficulty] ?? 'muted'}>
                    {labelOf(DIFFICULTY_LABEL, q.difficulty)}
                  </Pill>
                </td>
                <td className={`${TD} siq-numeric text-right`}>{q.marks}</td>
                <td className={`${TD} siq-numeric text-right`}>
                  {q._count.assessmentQuestions === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    `${q._count.assessmentQuestions} exam${q._count.assessmentQuestions === 1 ? '' : 's'}`
                  )}
                </td>
                <td className={`${TD} text-muted-foreground text-right text-xs whitespace-nowrap`}>
                  {shortDateTime(q.updatedAt)}
                </td>
              </TRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  )
}

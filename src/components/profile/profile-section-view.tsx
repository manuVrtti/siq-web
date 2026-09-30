'use client'

import {
  AcademicsForm,
  BasicsForm,
  LinksForm,
  ListSection,
  PreferencesForm,
  SkillsForm,
  type ListField,
} from '@/components/profile/section-forms'

/**
 * Picks the editor for the current section. Lives on the client because the
 * list sections take `itemTitle` functions, which can't cross the server →
 * client boundary.
 */

type Json = Record<string, unknown>

const YEAR = { kind: 'year' as const, placeholder: '2022' }

const EDUCATION: ListField[] = [
  { key: 'institution', label: 'Institution', kind: 'text', required: true, placeholder: 'ABES Engineering College', span: 2 },
  { key: 'degree', label: 'Degree / class', kind: 'text', required: true, placeholder: 'B.Tech · Class 12 · Diploma' },
  { key: 'field', label: 'Field / board', kind: 'text', placeholder: 'Computer Science · CBSE' },
  { key: 'startYear', label: 'Start year', ...YEAR },
  { key: 'endYear', label: 'End year', ...YEAR },
  { key: 'score', label: 'Score', kind: 'text', placeholder: '8.4 CGPA or 91%' },
]
const EXPERIENCE: ListField[] = [
  { key: 'company', label: 'Company', kind: 'text', required: true },
  { key: 'role', label: 'Role', kind: 'text', required: true, placeholder: 'Software Engineering Intern' },
  {
    key: 'kind',
    label: 'Type',
    kind: 'select',
    options: [
      { value: 'INTERNSHIP', label: 'Internship' },
      { value: 'FULL_TIME', label: 'Full-time' },
      { value: 'PART_TIME', label: 'Part-time' },
      { value: 'FREELANCE', label: 'Freelance' },
    ],
  },
  { key: 'current', label: 'I currently work here', kind: 'checkbox' },
  { key: 'startDate', label: 'Start', kind: 'month' },
  { key: 'endDate', label: 'End', kind: 'month' },
  { key: 'description', label: 'What you did', kind: 'textarea', placeholder: 'Built…, improved… by 30%, used…' },
]
const PROJECTS: ListField[] = [
  { key: 'title', label: 'Project title', kind: 'text', required: true },
  { key: 'url', label: 'Link', kind: 'url', placeholder: 'github.com/you/project' },
  { key: 'techStack', label: 'Tech used', kind: 'tags', placeholder: 'React, Node.js, PostgreSQL' },
  { key: 'description', label: 'What it does and your part', kind: 'textarea' },
]
const ACHIEVEMENTS: ListField[] = [
  { key: 'title', label: 'Title', kind: 'text', required: true, placeholder: 'Smart India Hackathon — finalist', span: 2 },
  { key: 'issuer', label: 'Issued by', kind: 'text', placeholder: 'AICTE' },
  { key: 'date', label: 'When', kind: 'month' },
  { key: 'url', label: 'Certificate / link', kind: 'url', span: 2 },
  { key: 'description', label: 'Details', kind: 'textarea' },
]

export function ProfileSectionView({
  section,
  data,
  userId,
  degrees,
  years,
}: {
  section: string
  data: {
    user: Json
    profile: Json | null
    education: Json[]
    experience: Json[]
    projects: Json[]
    achievements: Json[]
  }
  userId: string
  degrees: string[]
  years: number[]
}) {
  const p = data.profile ?? {}
  switch (section) {
    case 'academics':
      return <AcademicsForm initial={p} degrees={degrees} years={years} />
    case 'education':
      return (
        <ListSection
          section="education"
          fields={EDUCATION}
          initial={data.education}
          itemTitle={(i) => [i.degree, i.institution].filter(Boolean).join(' · ')}
          addLabel="Add education"
          emptyText="Add your degree, Class 12 and Class 10."
          max={10}
        />
      )
    case 'experience':
      return (
        <ListSection
          section="experience"
          fields={EXPERIENCE}
          initial={data.experience}
          itemTitle={(i) => [i.role, i.company].filter(Boolean).join(' at ')}
          addLabel="Add experience"
          emptyText="Internships count. So do part-time roles and freelance work."
          max={20}
        />
      )
    case 'projects':
      return (
        <ListSection
          section="projects"
          fields={PROJECTS}
          initial={data.projects}
          itemTitle={(i) => String(i.title ?? '')}
          addLabel="Add project"
          emptyText="Projects are the strongest signal recruiters have for freshers. Add your best one."
          max={20}
        />
      )
    case 'skills':
      return <SkillsForm initial={(p.skills as string[]) ?? []} />
    case 'achievements':
      return (
        <ListSection
          section="achievements"
          fields={ACHIEVEMENTS}
          initial={data.achievements}
          itemTitle={(i) => String(i.title ?? '')}
          addLabel="Add achievement"
          emptyText="Hackathons, certifications, competitive programming ranks, awards."
          max={30}
        />
      )
    case 'links':
      return (
        <LinksForm
          initial={p}
          userId={userId}
          resume={{
            fileName: (p.resumeFileName as string) ?? null,
            uploadedAt: (p.resumeUploadedAt as string) ?? null,
          }}
        />
      )
    case 'preferences':
      return <PreferencesForm initial={p} />
    default:
      return <BasicsForm initial={{ ...p, name: data.user.name }} />
  }
}

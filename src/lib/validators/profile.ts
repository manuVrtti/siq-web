import { z } from 'zod'

/**
 * Candidate profile validation. Shared by the API and the forms so a rule
 * lives in one place. Empty strings from form inputs are normalised to
 * `null` (cleared) before validation.
 */

const CURRENT_YEAR = new Date().getFullYear()

/** "" → null, trims, caps length. */
const optText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v),
    z.string().max(max).nullable().optional(),
  )

/**
 * "" / null → null (cleared); undefined → undefined (not sent — leave the
 * stored value alone). Accepts numeric strings from inputs. Collapsing
 * undefined to null here would wipe CGPA etc. whenever any OTHER section
 * saved a partial PATCH.
 */
const optNumber = (min: number, max: number, message: string) =>
  z.preprocess(
    (v) => (v === undefined ? undefined : v === '' || v === null ? null : typeof v === 'string' ? Number(v) : v),
    z.number({ message }).min(min, message).max(max, message).nullable().optional(),
  )

/** https URL on a public host, or null. */
const optUrl = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v
    const t = v.trim()
    if (!t) return null
    return /^https?:\/\//i.test(t) ? t : `https://${t}`
  },
  z
    .string()
    .max(300)
    .url('Enter a valid link')
    .refine((u) => /^https:\/\//i.test(u) || /^http:\/\//i.test(u), 'Enter a valid link')
    .nullable()
    .optional(),
)

const tagList = (maxItems: number, maxLen: number) =>
  z.preprocess(
    (v) =>
      Array.isArray(v)
        ? (() => {
            // Case-insensitive dedupe; the FIRST spelling wins ("Java" over "java").
            const seen = new Map<string, string>()
            for (const raw of v) {
              const t = String(raw).trim()
              if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t)
            }
            return [...seen.values()]
          })()
        : v,
    z.array(z.string().max(maxLen)).max(maxItems),
  )

export const PHONE_HINT = '10-digit mobile number'

/** Registration step: the minimum a placement cell needs to act on. */
export const registrationSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: z.string().trim().min(1, 'Enter your phone number'),
  degree: z.string().trim().min(1, 'Choose your degree').max(60),
  branch: z.string().trim().min(1, 'Enter your branch').max(80),
  graduationYear: z.coerce
    .number({ message: 'Choose your graduation year' })
    .int()
    .min(CURRENT_YEAR - 10, 'Choose your graduation year')
    .max(CURRENT_YEAR + 6, 'Choose your graduation year'),
  rollNumber: optText(40),
  /** Only honoured when the college lets students choose (Organization.studentsPickDepartment). */
  departmentId: z.string().trim().max(40).optional(),
})
export type RegistrationInput = z.infer<typeof registrationSchema>

/** Everything on the profile that isn't a repeating list. */
export const profileBasicsSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120).optional(),
  headline: optText(140),
  about: optText(2000),
  city: optText(80),
  rollNumber: optText(40),
  degree: optText(60),
  branch: optText(80),
  graduationYear: optNumber(CURRENT_YEAR - 10, CURRENT_YEAR + 6, 'Enter a valid graduation year'),
  cgpa: optNumber(0, 10, 'CGPA must be between 0 and 10'),
  tenthPercent: optNumber(0, 100, 'Percentage must be between 0 and 100'),
  twelfthPercent: optNumber(0, 100, 'Percentage must be between 0 and 100'),
  activeBacklogs: optNumber(0, 50, 'Backlogs must be between 0 and 50'),
  skills: tagList(40, 40).optional(),
  linkedinUrl: optUrl,
  githubUrl: optUrl,
  portfolioUrl: optUrl,
  codingUrl: optUrl,
  preferredRoles: tagList(10, 60).optional(),
  preferredLocations: tagList(10, 60).optional(),
  openToRelocate: z.boolean().nullable().optional(),
  expectedCtcLpa: optNumber(0, 200, 'Expected CTC must be between 0 and 200 LPA'),
})
export type ProfileBasicsInput = z.infer<typeof profileBasicsSchema>

const optDate = z.preprocess(
  (v) => (v === undefined ? undefined : v === '' || v === null ? null : v),
  z.coerce.date().nullable().optional(),
)
const optYear = optNumber(1990, CURRENT_YEAR + 8, 'Enter a valid year')

export const educationItem = z.object({
  institution: z.string().trim().min(1, 'Institution is required').max(160),
  degree: z.string().trim().min(1, 'Degree is required').max(80),
  field: optText(80),
  startYear: optYear,
  endYear: optYear,
  score: optText(30),
})
export const experienceItem = z
  .object({
    company: z.string().trim().min(1, 'Company is required').max(120),
    role: z.string().trim().min(1, 'Role is required').max(120),
    kind: z.enum(['INTERNSHIP', 'FULL_TIME', 'PART_TIME', 'FREELANCE']).default('INTERNSHIP'),
    startDate: optDate,
    endDate: optDate,
    current: z.boolean().default(false),
    description: optText(2000),
  })
  .refine((e) => !e.startDate || !e.endDate || e.endDate >= e.startDate, {
    message: 'End date is before the start date',
    path: ['endDate'],
  })
export const projectItem = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  description: optText(2000),
  techStack: tagList(15, 40).default([]),
  url: optUrl,
})
export const achievementItem = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  issuer: optText(120),
  date: optDate,
  url: optUrl,
  description: optText(1000),
})

/** Repeating sections: the client always sends the full list (replace semantics). */
export const SECTION_SCHEMAS = {
  education: z.array(educationItem).max(10),
  experience: z.array(experienceItem).max(20),
  projects: z.array(projectItem).max(20),
  achievements: z.array(achievementItem).max(30),
} as const
export type ProfileSection = keyof typeof SECTION_SCHEMAS
export const PROFILE_SECTIONS = Object.keys(SECTION_SCHEMAS) as ProfileSection[]

export const DEGREES = ['B.Tech', 'B.E.', 'M.Tech', 'M.E.', 'MCA', 'BCA', 'B.Sc', 'M.Sc', 'MBA', 'Diploma', 'Other'] as const

export function graduationYears(): number[] {
  return Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 3 + i)
}

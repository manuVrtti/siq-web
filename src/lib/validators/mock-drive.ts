import { z } from 'zod'

/** Plan 023 — mock drive validation. */

export const DRIVE_MODES = ['COLLEGE_SIMULATED', 'SAMPLE_COMPANY'] as const
export const DRIVE_STATUSES = ['DRAFT', 'SCHEDULED', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'] as const

const optDate = z
  .string()
  .datetime({ offset: true })
  .nullish()
  .transform((v) => (v ? new Date(v) : null))

export const driveInputSchema = z
  .object({
    mode: z.enum(DRIVE_MODES).default('COLLEGE_SIMULATED'),
    title: z.string().trim().min(2, 'Give the drive a title').max(200),
    description: z.string().trim().max(5000).nullish(),
    employerName: z.string().trim().max(120).nullish(),
    employerLogo: z
      .string()
      .trim()
      .url('Logo must be a link')
      .refine((u) => u.startsWith('https://'), 'Logo link must start with https://')
      .nullish()
      .or(z.literal('').transform(() => null)),
    roleTitle: z.string().trim().min(2, 'Add the role, e.g. Software Engineer').max(120),
    roleCtc: z.string().trim().max(60).nullish(),
    sampleCompanyOrgId: z.string().min(1).nullish(),
    departmentIds: z.array(z.string().min(1)).max(50).default([]),
    batchYears: z.array(z.number().int().min(2000).max(2100)).max(10).default([]),
    minCgpa: z.number().min(0).max(10).nullish(),
    startDate: optDate,
    endDate: optDate,
    registrationDeadline: optDate,
  })
  .superRefine((d, ctx) => {
    if (d.mode === 'COLLEGE_SIMULATED' && !d.employerName)
      ctx.addIssue({ code: 'custom', path: ['employerName'], message: 'Name the simulated employer' })
    if (d.mode === 'SAMPLE_COMPANY' && !d.sampleCompanyOrgId)
      ctx.addIssue({ code: 'custom', path: ['sampleCompanyOrgId'], message: 'Choose the sample company' })
    if (d.startDate && d.endDate && d.endDate <= d.startDate)
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The drive must end after it starts' })
    if (d.registrationDeadline && d.endDate && d.registrationDeadline > d.endDate)
      ctx.addIssue({ code: 'custom', path: ['registrationDeadline'], message: 'Registration must close before the drive ends' })
  })

export type DriveInput = z.infer<typeof driveInputSchema>

export const roundInputSchema = z.object({
  assessmentId: z.string().min(1, 'Choose a test for this round'),
  name: z.string().trim().min(1).max(120).optional(),
  cutoffScore: z.number().min(0).max(100).nullish(),
  scheduledAt: optDate,
})

export const roundUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  cutoffScore: z.number().min(0).max(100).nullish(),
  scheduledAt: optDate.optional(),
})

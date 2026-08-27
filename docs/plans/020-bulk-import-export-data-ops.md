# Plan 020 — Bulk Import, Export & Data Operations

## 1. Objective

Build bulk data operations: importing questions and candidates from CSV/Excel, exporting results and analytics to Excel/PDF, and generating candidate reports — closing the loop on Sprint 2's data lifecycle.

## 2. Scope

- Question bank bulk import (CSV/Excel with template)
- Candidate bulk import (CSV/Excel, upgrade from Plan 13's paste-list)
- Results export (Excel, per-assessment)
- Analytics export (Excel/PDF)
- Individual candidate report (PDF)
- Import validation with error reporting

### Out of Scope

- Scheduled/automated exports (future)
- Third-party integrations (ATS sync — future)
- Real-time data sync
- Certificate generation (future)

## 3. Prerequisites / Dependencies

- Plan 11 (questions to import into)
- Plan 13 (candidates to import)
- Plan 16 (results to export)
- Plan 19 (analytics to export)

## 4. Technical Approach

Use SheetJS (xlsx) for Excel read/write and a PDF library for report generation. Imports follow a template-driven approach: users download a template, fill it, upload it, and the system validates row-by-row, reporting errors before committing (dry-run preview → confirm).

Exports are generated server-side and returned as file downloads. Large exports stream or paginate to avoid memory issues.

## 5. Implementation Steps

1. Install libraries:
   - `npm install xlsx` (SheetJS — Excel read/write)
   - `npm install @react-pdf/renderer` or `pdf-lib` (PDF generation)
2. Create `lib/import/xlsx-parser.ts`:
   - `parseSheet(buffer)` — returns rows as objects
   - `validateHeaders(rows, expectedHeaders)` — schema check
3. Create `services/import/question-import.ts`:
   - `getQuestionTemplate()` — generates downloadable Excel template with columns (type, title, body, difficulty, marks, option1..4, correctOptions, tags, explanation)
   - `validateQuestionImport(orgId, rows)` — dry-run: validates each row, returns `{ valid: [], errors: [{ row, message }] }`
   - `commitQuestionImport(orgId, userId, validRows)` — bulk create
4. Create `services/import/candidate-import.ts`:
   - `getCandidateTemplate()` — Excel template (name, email, phone, batch)
   - `validateCandidateImport(orgId, rows)` — dry-run validation (email/phone format, duplicates)
   - `commitCandidateImport(orgId, validRows)` — bulk create + optional batch assignment
5. Create `services/export/results-export.ts`:
   - `exportAssessmentResults(assessmentId)` — Excel: candidate, score, %, status, pass/fail, per-section, time, proctoring flags
   - `exportBatchResults(batchId)` — cross-assessment batch export
6. Create `services/export/analytics-export.ts`:
   - `exportAssessmentAnalytics(assessmentId)` — Excel with metric sheets (score dist, question analysis)
7. Create `services/export/candidate-report.ts`:
   - `generateCandidateReport(userId, assessmentId)` — PDF: candidate info, score summary, per-question breakdown, proctoring summary, org branding
8. Create API routes:
   - `/app/api/import/questions/template/route.ts` — GET (download template)
   - `/app/api/import/questions/validate/route.ts` — POST (dry-run)
   - `/app/api/import/questions/commit/route.ts` — POST (execute)
   - `/app/api/import/candidates/template/route.ts` — GET
   - `/app/api/import/candidates/validate/route.ts` — POST
   - `/app/api/import/candidates/commit/route.ts` — POST
   - `/app/api/export/assessments/[id]/results/route.ts` — GET (Excel download)
   - `/app/api/export/assessments/[id]/analytics/route.ts` — GET (Excel download)
   - `/app/api/export/candidates/[userId]/report/route.ts` — GET (PDF, scoped to assessment via query)
9. Create import UI components:
   - `components/import/import-wizard.tsx` — reusable: download template → upload → preview errors → confirm
   - Used for both questions and candidates
10. Wire into existing pages:
    - Questions page (Plan 11): "Import Questions" button → wizard
    - Candidates page (Plan 13): replace paste-list with full import wizard
    - Assessment results page (Plan 16): "Export to Excel" button
    - Assessment analytics page (Plan 19): "Export Report" button
    - Candidate result detail: "Download PDF Report" button
11. Add export progress/loading states (large exports)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Install | `xlsx`, `@react-pdf/renderer` | Excel + PDF |
| Create | `lib/import/xlsx-parser.ts` | Excel parsing |
| Create | `services/import/question-import.ts` | Question import |
| Create | `services/import/candidate-import.ts` | Candidate import |
| Create | `services/export/results-export.ts` | Results export |
| Create | `services/export/analytics-export.ts` | Analytics export |
| Create | `services/export/candidate-report.ts` | PDF report |
| Create | `app/api/import/questions/*/route.ts` | Question import APIs |
| Create | `app/api/import/candidates/*/route.ts` | Candidate import APIs |
| Create | `app/api/export/assessments/[id]/results/route.ts` | Results export |
| Create | `app/api/export/assessments/[id]/analytics/route.ts` | Analytics export |
| Create | `app/api/export/candidates/[userId]/report/route.ts` | PDF report |
| Create | `components/import/import-wizard.tsx` | Import wizard |
| Modify | `app/(protected)/questions/page.tsx` | Import button |
| Modify | `app/(protected)/candidates/page.tsx` | Import wizard |
| Modify | `app/(protected)/assessments/[id]/results/page.tsx` | Export button |
| Modify | `app/(protected)/assessments/[id]/analytics/page.tsx` | Export button |

## 7. Testing / Verification

- [ ] Download question template → valid Excel with headers
- [ ] Import valid questions → all created
- [ ] Import with errors (missing correct option) → errors shown, nothing committed
- [ ] Fix errors and re-import → succeeds
- [ ] Download candidate template → valid Excel
- [ ] Import candidates → User records created, batch assigned
- [ ] Import duplicate candidate → flagged, not duplicated
- [ ] Export assessment results → Excel with all candidates + scores
- [ ] Excel export includes proctoring flags column
- [ ] Export analytics → Excel with metric sheets
- [ ] Generate candidate PDF report → correct data, branding, breakdown
- [ ] Large import (500+ rows) → completes without timeout
- [ ] Role check: only admin/recruiter can import/export
- [ ] Cross-org: can't export another org's data
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: import wizard pattern (template → validate → commit), export formats, SheetJS + PDF usage
- Add to `docs/project-context.md`: Plan 20 completed, Sprint 2 complete — full assessment lifecycle operational
- Sprint 2 summary: question bank → assessment builder → assignment → exam runtime → grading → results → proctoring → analytics → import/export

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~25 minutes (import validation, export formats, PDF)
- Documentation updates: ~10 minutes

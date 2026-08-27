# Plan 048 — Audit Logging & Activity Trails

## 1. Objective

Build comprehensive audit logging that captures security-relevant and consequential actions across the platform, surfaced through admin trails for accountability, compliance, and incident investigation.

## 2. Scope

- Structured audit logging service (extends Plan 03's AuditLog)
- Automatic capture of consequential actions
- Actor, action, target, before/after context
- Org-scoped and platform-wide audit trails
- Audit log search and filtering
- Tamper-evidence and retention
- Exam integrity trail (who accessed what during assessments)

### Out of Scope

- SIEM integration (Sprint 6/enterprise)
- Real-time security alerting (basic flagging here)
- Legal hold / e-discovery tooling

## 3. Prerequisites / Dependencies

- Plan 03 (base AuditLog model)
- Plan 33 (search — audit trail search)
- Plan 34 (async — audit writes can be queued to avoid latency)

## 4. Technical Approach

Plan 03 created a basic `AuditLog`. This plan operationalizes it into a first-class subsystem: a centralized `audit()` helper called from consequential actions (role changes, deletions, publishes, grade overrides, offer decisions, billing changes, exam access). It captures actor, action, target entity, and a diff of before/after where relevant.

Audit writes are async (Plan 34) so they never slow user actions. Logs are append-only (no update/delete via app), with a periodic integrity hash chain for tamper-evidence. Trails are role-scoped: org admins see their org's actions; SuperAdmin sees everything.

Special attention to **exam integrity**: every access to an in-progress/submitted exam, grade change, and proctoring review is logged — critical for challenge/dispute resolution.

## 5. Implementation Steps

1. Extend AuditLog (Plan 03):
   ```prisma
   // Extend AuditLog with:
   //   orgId       String?
   //   actorRole   String?
   //   targetType  String
   //   targetId    String?
   //   before      Json?
   //   after       Json?
   //   ipAddress   String?
   //   userAgent   String?
   //   severity    String   @default("INFO")  // INFO | WARNING | CRITICAL
   //   integrityHash String?
   // Add indexes: [orgId, createdAt], [targetType, targetId], [severity]
   ```
2. Run migration: `npx prisma migrate dev --name audit_enhancements`
3. Create `lib/audit/audit.ts`:
   - `audit(ctx, action, target, opts?)` — captures actor (from request), action, target, before/after, IP/UA, severity
   - Enqueues audit write via Plan 34 (async) — or direct for CRITICAL to guarantee persistence
   - `computeIntegrityHash(entry, prevHash)` — hash chain
4. Create `lib/audit/actions.ts`:
   - Enumerated audit action constants (e.g., `ROLE_CHANGED`, `ASSESSMENT_PUBLISHED`, `GRADE_OVERRIDDEN`, `OFFER_EXTENDED`, `EXAM_ACCESSED`, `SUBSCRIPTION_CHANGED`, `MEMBER_REMOVED`, `QUESTION_DELETED`)
5. Instrument consequential actions with `audit()`:
   - RBAC/org: role changes, member removal (Plan 35)
   - Assessments: publish, delete, grade override (Plans 12, 16)
   - Recruitment: offer decisions, application rejections (Plans 24, 27)
   - Billing: subscription changes (Plan 36)
   - Exam integrity: attempt access, answer views, proctoring review (Plans 15, 18)
   - Security: login, failed auth, permission denials (Plans 04–07)
6. Create `services/audit-trail.ts`:
   - `queryTrail(scope, filters)` — role-scoped search (actor, action, target, date, severity)
   - `getEntityHistory(targetType, targetId)` — all actions on one entity
   - `verifyIntegrity(range)` — validate hash chain
7. Create API routes:
   - `/app/api/audit/route.ts` — GET (scoped trail, filtered)
   - `/app/api/audit/entity/[type]/[id]/route.ts` — GET (entity history)
   - `/app/api/admin/audit/verify/route.ts` — POST (integrity check, SuperAdmin)
8. Create admin pages:
   - `/app/(protected)/admin/audit/page.tsx` — platform audit trail (SuperAdmin): search, filter, severity highlights
   - `/app/(protected)/settings/audit/page.tsx` — org audit trail (org admins): their org's actions
9. Add entity history to key detail views:
   - Assessment, application, offer detail pages → "Activity" tab showing audit history
10. Create retention job (Plan 34 cron):
    - `/app/api/cron/audit-retention/route.ts` — archive/prune per retention policy (configurable, default: keep CRITICAL indefinitely, INFO for N months)
11. Create components:
    - `components/audit/audit-trail-table.tsx`
    - `components/audit/audit-filters.tsx`
    - `components/audit/entity-history.tsx`
    - `components/audit/severity-badge.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | AuditLog enhancements |
| Create | `lib/audit/audit.ts` | Audit helper |
| Create | `lib/audit/actions.ts` | Action constants |
| Modify | Many services | Instrument with audit() |
| Create | `services/audit-trail.ts` | Trail queries |
| Create | `app/api/audit/*/route.ts` | Audit APIs |
| Create | `app/api/cron/audit-retention/route.ts` | Retention |
| Create | `app/(protected)/admin/audit/page.tsx` | Platform trail |
| Create | `app/(protected)/settings/audit/page.tsx` | Org trail |
| Create | `components/audit/*.tsx` | Audit UI |

## 7. Testing / Verification

- [ ] Role change → audit entry with before/after roles, actor, IP
- [ ] Assessment publish → logged
- [ ] Grade override → logged as CRITICAL with before/after score
- [ ] Offer extended/declined → logged
- [ ] Subscription change → logged
- [ ] Exam access by admin → logged (exam integrity)
- [ ] Failed login / permission denial → logged as WARNING
- [ ] Audit writes async (don't slow the triggering action)
- [ ] Org admin sees only their org's trail
- [ ] SuperAdmin sees platform-wide trail
- [ ] Filter by actor/action/date/severity works
- [ ] Entity history shows all actions on one assessment
- [ ] Integrity verification passes on unmodified chain
- [ ] App cannot update/delete audit entries (append-only)
- [ ] Retention cron runs correctly
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: "Call `audit()` on all consequential actions; audit log is append-only"
- Add to `CLAUDE.md`: action taxonomy, severity levels, integrity chain, exam-integrity logging
- Add to `docs/project-context.md`: Plan 37 completed, audit logging live

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~20 minutes (instrumentation coverage, scoping, integrity)
- Documentation updates: ~5 minutes

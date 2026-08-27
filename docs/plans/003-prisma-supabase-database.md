# Plan 003 — Prisma + Supabase Database Connection

## 1. Objective

Initialize Prisma ORM, connect to Supabase PostgreSQL, and define the foundational schema tables that every subsequent plan depends on.

## 2. Scope

- Initialize Prisma with PostgreSQL provider
- Define core models: User, Organization, OrganizationMember, AuditLog
- Create Prisma client singleton with dev hot-reload guard
- Run first migration against Supabase
- Verify with a health check API route

### Out of Scope

- Full 142-table schema (added incrementally in later sprints as features need them)
- Supabase client SDK setup (Plan 09 — storage only)
- Any Supabase Auth usage (Firebase handles all auth)
- Row Level Security policies (evaluated per-sprint as needed)

## 3. Prerequisites / Dependencies

- Plan 01 completed (Next.js project)
- Plan 02 completed (`DATABASE_URL` available in validated env)
- Supabase project created with PostgreSQL connection string ready

## 4. Technical Approach

Prisma is the exclusive ORM — no raw SQL, no Drizzle, no Knex. The Supabase JS client is used only for file storage operations (Plan 09). All structured data access goes through Prisma.

The initial schema defines the minimum tables needed for auth and RBAC (Plans 04–07). Keeping this small means faster migrations and easier iteration. Additional tables are added via `prisma migrate dev` in future sprints.

Hot-reload guard pattern prevents multiple Prisma Client instances during Next.js dev server restarts.

## 5. Implementation Steps

1. Install Prisma: `npm install prisma @prisma/client`
2. Run `npx prisma init` — generates `prisma/schema.prisma` and updates `.env`
3. Configure `schema.prisma`:
   ```prisma
   generator client {
     provider = "prisma-client-js"
   }

   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }

   enum UserRole {
     SUPER_ADMIN
     COLLEGE_ADMIN
     RECRUITER
     STUDENT
   }

   enum OrgType {
     COLLEGE
     COMPANY
   }

   enum OrgMemberRole {
     ADMIN
     MEMBER
   }

   model User {
     id            String    @id @default(cuid())
     email         String?   @unique
     phone         String?   @unique
     name          String?
     avatarUrl     String?
     role          UserRole  @default(STUDENT)
     firebaseUid   String    @unique
     lastLoginAt   DateTime?
     createdAt     DateTime  @default(now())
     updatedAt     DateTime  @updatedAt

     memberships   OrganizationMember[]
     auditLogs     AuditLog[]
   }

   model Organization {
     id          String    @id @default(cuid())
     name        String
     type        OrgType
     domain      String?
     logoUrl     String?
     createdAt   DateTime  @default(now())
     updatedAt   DateTime  @updatedAt

     members     OrganizationMember[]
   }

   model OrganizationMember {
     id        String        @id @default(cuid())
     userId    String
     orgId     String
     role      OrgMemberRole @default(MEMBER)
     joinedAt  DateTime      @default(now())

     user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
     org       Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)

     @@unique([userId, orgId])
   }

   model AuditLog {
     id          String   @id @default(cuid())
     userId      String
     action      String
     entityType  String
     entityId    String?
     metadata    Json?
     createdAt   DateTime @default(now())

     user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@index([userId])
     @@index([entityType, entityId])
     @@index([createdAt])
   }
   ```
4. Create `lib/prisma.ts` — singleton client:
   ```typescript
   import { PrismaClient } from '@prisma/client';

   const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

   export const prisma = globalForPrisma.prisma || new PrismaClient();

   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
   ```
5. Run `npx prisma migrate dev --name init` — creates tables in Supabase
6. Run `npx prisma generate` — generates typed client
7. Create `/app/api/health/db/route.ts`:
   ```typescript
   // SELECT 1 via Prisma to verify connection
   // Returns { status: 'ok', timestamp } or { status: 'error', message }
   ```
8. Add Prisma scripts to `package.json`:
   - `"db:migrate": "prisma migrate dev"`
   - `"db:push": "prisma db push"`
   - `"db:studio": "prisma studio"`
   - `"db:generate": "prisma generate"`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Install | `prisma`, `@prisma/client` | ORM packages |
| Create | `prisma/schema.prisma` | Core schema with 4 models |
| Create | `lib/prisma.ts` | Singleton client |
| Create | `app/api/health/db/route.ts` | DB health check |
| Create | `prisma/migrations/` | Auto-generated migration files |
| Modify | `package.json` | Prisma scripts |

## 7. Testing / Verification

- [ ] `npx prisma migrate dev` runs without errors
- [ ] `npx prisma studio` opens and shows all 4 tables
- [ ] `GET /api/health/db` returns `{ status: 'ok' }`
- [ ] Prisma client types autocomplete in IDE (e.g., `prisma.user.findMany()`)
- [ ] Tables visible in Supabase dashboard under Table Editor
- [ ] `npm run build` passes (Prisma generate included)

## 8. Documentation Updates

- Add to `CLAUDE.md`: "Prisma is the exclusive ORM. Use `@/lib/prisma` singleton. Never use raw SQL or Supabase client for data queries."
- Add to `CLAUDE.md`: schema conventions (cuid IDs, createdAt/updatedAt pattern, enum naming)
- Add to `docs/project-context.md`: Plan 03 completed, 4 core models deployed

## 9. Estimated Effort

- Claude Code execution: ~25 minutes
- Manual testing: ~10 minutes
- Documentation updates: ~5 minutes

# Plan 014 — Judge0 Code Execution Integration

## 1. Objective

Integrate the self-hosted Judge0 CE engine to execute candidate code submissions against test cases for coding questions, with support for multiple languages and secure evaluation.

## 2. Scope

- Judge0 API client wrapper
- Coding question test case model (public + hidden test cases)
- Code submission execution (run + evaluate)
- Multi-language support (config for supported languages)
- Result parsing (pass/fail per test case, runtime, memory, errors)
- Submission queueing and status polling

### Out of Scope

- Live exam-taking UI (Plan 15 — this plan is the execution backend)
- Plagiarism detection (future sprint)
- Custom judge scripts (special judges — future)
- Judge0 server provisioning (existing asset per stack)

## 3. Prerequisites / Dependencies

- Plan 11 complete (Question model — extends CODING type)
- Plan 02 (`JUDGE0_API_URL` in env)
- Self-hosted Judge0 CE instance running and reachable

## 4. Technical Approach

Judge0 executes code in isolated sandboxes and returns results per submission. The flow:

1. Coding question stores test cases (input + expected output), some hidden from candidates
2. On submission: for each test case, send `{ source_code, language_id, stdin, expected_output }` to Judge0
3. Judge0 returns status (Accepted, Wrong Answer, TLE, Runtime Error, Compilation Error), stdout, time, memory
4. Aggregate results → score = (passed test cases / total) × marks, or all-or-nothing per config

Use Judge0's batch submission endpoint for efficiency. Poll for results (Judge0 is async) or use `wait=true` for synchronous execution on small test sets.

## 5. Implementation Steps

1. Extend Prisma schema for coding questions:
   ```prisma
   model CodingQuestion {
     id            String    @id @default(cuid())
     questionId    String    @unique
     starterCode   Json?     // { languageId: code } starter templates
     timeLimit     Float     @default(2)   // seconds
     memoryLimit   Int       @default(128) // MB
     allowedLanguages Int[]  // Judge0 language IDs

     question      Question  @relation(fields: [questionId], references: [id], onDelete: Cascade)
     testCases     TestCase[]
   }

   model TestCase {
     id                String    @id @default(cuid())
     codingQuestionId  String
     input             String    @db.Text
     expectedOutput    String    @db.Text
     isHidden          Boolean   @default(false)
     weight            Int       @default(1)
     order             Int

     codingQuestion    CodingQuestion @relation(fields: [codingQuestionId], references: [id], onDelete: Cascade)

     @@index([codingQuestionId])
   }

   model CodeSubmission {
     id            String    @id @default(cuid())
     assignmentId  String?
     questionId    String
     userId        String
     languageId    Int
     sourceCode    String    @db.Text
     status        String    // Judge0 status
     passedCount   Int       @default(0)
     totalCount    Int       @default(0)
     score         Float     @default(0)
     runtimeMs     Float?
     memoryKb      Float?
     results       Json?     // per-test-case detail
     submittedAt   DateTime  @default(now())

     user          User      @relation(fields: [userId], references: [id])

     @@index([userId])
     @@index([questionId])
   }
   ```
2. Run migration: `npx prisma migrate dev --name judge0_coding`
3. Create `lib/judge0.ts` — API wrapper:
   ```typescript
   export const LANGUAGES = {
     PYTHON3: 71,
     JAVA: 62,
     CPP: 54,
     C: 50,
     JAVASCRIPT: 63,
     // ...extend as needed
   };

   export async function submitBatch(submissions: Judge0Submission[]): Promise<string[]> // tokens
   export async function getBatchResults(tokens: string[]): Promise<Judge0Result[]>
   export async function executeSingle(submission: Judge0Submission): Promise<Judge0Result> // wait=true
   ```
   - Base64-encode source/stdin/expected (Judge0 recommendation)
   - Configure `cpu_time_limit`, `memory_limit` from question
4. Create `services/code-execution.ts`:
   - `runCode(questionId, languageId, sourceCode, testCases)` — execute against provided test cases (used for "Run" in editor — public test cases only)
   - `evaluateSubmission(assignmentId, questionId, userId, languageId, sourceCode)` — execute against ALL test cases (public + hidden), compute score, persist `CodeSubmission`
   - `pollResults(tokens)` — poll until all complete (with timeout)
5. Create validation `lib/validators/coding.ts`:
   - Coding question must have ≥1 test case, ≥1 allowed language
6. Extend question form (Plan 11) for CODING type:
   - Starter code per language
   - Time/memory limits
   - Test case editor (input/output pairs, hidden toggle)
   - Allowed languages multi-select
7. Create API routes:
   - `/app/api/code/run/route.ts` — POST (run against public test cases, auth required)
   - `/app/api/code/submit/route.ts` — POST (full evaluation, tied to assignment)
   - `/app/api/code/submissions/[id]/route.ts` — GET (submission result)
8. Create `/app/api/health/judge0/route.ts` — health check (Judge0 `/about` endpoint)
9. Add Judge0 to aggregate health check (`/api/health/all`)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | CodingQuestion, TestCase, CodeSubmission |
| Create | `lib/judge0.ts` | Judge0 API wrapper |
| Create | `services/code-execution.ts` | Execution + evaluation logic |
| Create | `lib/validators/coding.ts` | Coding question validation |
| Modify | `components/questions/question-form.tsx` | Coding question fields |
| Create | `app/api/code/run/route.ts` | Run endpoint |
| Create | `app/api/code/submit/route.ts` | Submit endpoint |
| Create | `app/api/code/submissions/[id]/route.ts` | Result fetch |
| Create | `app/api/health/judge0/route.ts` | Judge0 health |
| Modify | `app/api/health/all/route.ts` | Include Judge0 |

## 7. Testing / Verification

- [ ] Judge0 health check passes
- [ ] Create coding question with starter code + test cases → saved
- [ ] Run correct Python solution → all public test cases pass
- [ ] Run incorrect solution → wrong answer reported
- [ ] Submit solution → evaluated against hidden test cases too, score computed
- [ ] Infinite loop → TLE reported (time limit enforced)
- [ ] Syntax error → compilation error reported
- [ ] Memory-heavy code → memory limit enforced
- [ ] Multiple languages: Java, C++, Python all execute
- [ ] Submission persisted with per-test-case results
- [ ] Hidden test cases not exposed to candidate in run results
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: Judge0 integration, language IDs, run vs submit distinction, test case model
- Add to `CLAUDE.md`: "Hidden test cases never returned in `/run` responses, only aggregate in `/submit`"
- Add to `docs/project-context.md`: Plan 14 completed, code execution live

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~25 minutes (multiple languages, edge cases)
- Documentation updates: ~5 minutes

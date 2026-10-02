-- AlterEnum
ALTER TYPE "ResultStatus" ADD VALUE 'SUPERSEDED';

-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "archivedAssignmentId" TEXT,
ALTER COLUMN "assignmentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "IdentityCheck" ADD COLUMN     "attemptId" TEXT,
ALTER COLUMN "assignmentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "supersededAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AttemptRetake" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "previousAttemptId" TEXT NOT NULL,
    "previousResultId" TEXT,
    "grantedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttemptRetake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttemptRetake_assignmentId_idx" ON "AttemptRetake"("assignmentId");

-- CreateIndex
CREATE INDEX "AttemptRetake_userId_idx" ON "AttemptRetake"("userId");

-- CreateIndex
CREATE INDEX "ExamAttempt_archivedAssignmentId_idx" ON "ExamAttempt"("archivedAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCheck_attemptId_key" ON "IdentityCheck"("attemptId");

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_archivedAssignmentId_fkey" FOREIGN KEY ("archivedAssignmentId") REFERENCES "AssessmentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCheck" ADD CONSTRAINT "IdentityCheck_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptRetake" ADD CONSTRAINT "AttemptRetake_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "AssessmentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptRetake" ADD CONSTRAINT "AttemptRetake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptRetake" ADD CONSTRAINT "AttemptRetake_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: link existing identity checks to the attempt they led to.
UPDATE "IdentityCheck" ic SET "attemptId" = ea."id"
FROM "ExamAttempt" ea
WHERE ea."assignmentId" = ic."assignmentId" AND ic."attemptId" IS NULL;

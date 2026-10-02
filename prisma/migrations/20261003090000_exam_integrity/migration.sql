-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProctoringFlagType" ADD VALUE 'COPY';
ALTER TYPE "ProctoringFlagType" ADD VALUE 'CUT';
ALTER TYPE "ProctoringFlagType" ADD VALUE 'PASTE';
ALTER TYPE "ProctoringFlagType" ADD VALUE 'CONTEXT_MENU';
ALTER TYPE "ProctoringFlagType" ADD VALUE 'SCREENSHOT_ATTEMPT';
ALTER TYPE "ProctoringFlagType" ADD VALUE 'SHORTCUT_BLOCKED';
ALTER TYPE "ProctoringFlagType" ADD VALUE 'SECOND_SCREEN';
ALTER TYPE "ProctoringFlagType" ADD VALUE 'IDENTITY_MISMATCH';

-- CreateTable
CREATE TABLE "IdentityPhoto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "orgId" TEXT,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityCheck" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "snapshotPath" TEXT NOT NULL,
    "photoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctoringCheck" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "matchScore" DOUBLE PRECISION,
    "faceCount" INTEGER NOT NULL,
    "snapshotPath" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProctoringCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdentityPhoto_userId_status_idx" ON "IdentityPhoto"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCheck_assignmentId_key" ON "IdentityCheck"("assignmentId");

-- CreateIndex
CREATE INDEX "IdentityCheck_userId_idx" ON "IdentityCheck"("userId");

-- CreateIndex
CREATE INDEX "ProctoringCheck_sessionId_idx" ON "ProctoringCheck"("sessionId");

-- AddForeignKey
ALTER TABLE "IdentityPhoto" ADD CONSTRAINT "IdentityPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCheck" ADD CONSTRAINT "IdentityCheck_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "AssessmentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCheck" ADD CONSTRAINT "IdentityCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCheck" ADD CONSTRAINT "IdentityCheck_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "IdentityPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringCheck" ADD CONSTRAINT "ProctoringCheck_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProctoringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;


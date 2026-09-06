-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('INVITED', 'STARTED', 'SUBMITTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchMember" (
    "batchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchMember_pkey" PRIMARY KEY ("batchId","userId")
);

-- CreateTable
CREATE TABLE "AssessmentAssignment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AssessmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Batch_orgId_idx" ON "Batch"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_orgId_name_key" ON "Batch"("orgId", "name");

-- CreateIndex
CREATE INDEX "BatchMember_userId_idx" ON "BatchMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAssignment_token_key" ON "AssessmentAssignment"("token");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_token_idx" ON "AssessmentAssignment"("token");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_userId_idx" ON "AssessmentAssignment"("userId");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_status_idx" ON "AssessmentAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAssignment_assessmentId_userId_key" ON "AssessmentAssignment"("assessmentId", "userId");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMember" ADD CONSTRAINT "BatchMember_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMember" ADD CONSTRAINT "BatchMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


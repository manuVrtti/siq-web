-- CreateEnum
CREATE TYPE "MockDriveMode" AS ENUM ('COLLEGE_SIMULATED', 'SAMPLE_COMPANY');

-- CreateEnum
CREATE TYPE "MockDriveStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MockRoundOutcome" AS ENUM ('PENDING', 'SHORTLISTED', 'ELIMINATED');

-- CreateTable
CREATE TABLE "MockDrive" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "mode" "MockDriveMode" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MockDriveStatus" NOT NULL DEFAULT 'DRAFT',
    "employerName" TEXT NOT NULL,
    "employerLogo" TEXT,
    "roleTitle" TEXT NOT NULL,
    "roleCtc" TEXT,
    "sampleCompanyOrgId" TEXT,
    "batchYears" INTEGER[],
    "minCgpa" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "registrationDeadline" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockDrive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockDriveRound" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "cutoffScore" DOUBLE PRECISION,
    "scheduledAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "MockDriveRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockDriveTarget" (
    "driveId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "MockDriveTarget_pkey" PRIMARY KEY ("driveId","departmentId")
);

-- CreateTable
CREATE TABLE "MockDriveRegistration" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "eliminated" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'SELF',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockDriveRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockRoundResult" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "score" DOUBLE PRECISION,
    "outcome" "MockRoundOutcome" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "overrideReason" TEXT,

    CONSTRAINT "MockRoundResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MockDrive_orgId_status_idx" ON "MockDrive"("orgId", "status");

-- CreateIndex
CREATE INDEX "MockDriveRound_assessmentId_idx" ON "MockDriveRound"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "MockDriveRound_driveId_order_key" ON "MockDriveRound"("driveId", "order");

-- CreateIndex
CREATE INDEX "MockDriveTarget_departmentId_idx" ON "MockDriveTarget"("departmentId");

-- CreateIndex
CREATE INDEX "MockDriveRegistration_userId_idx" ON "MockDriveRegistration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MockDriveRegistration_driveId_userId_key" ON "MockDriveRegistration"("driveId", "userId");

-- CreateIndex
CREATE INDEX "MockRoundResult_roundId_idx" ON "MockRoundResult"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "MockRoundResult_registrationId_roundId_key" ON "MockRoundResult"("registrationId", "roundId");

-- AddForeignKey
ALTER TABLE "MockDrive" ADD CONSTRAINT "MockDrive_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockDrive" ADD CONSTRAINT "MockDrive_sampleCompanyOrgId_fkey" FOREIGN KEY ("sampleCompanyOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockDrive" ADD CONSTRAINT "MockDrive_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockDriveRound" ADD CONSTRAINT "MockDriveRound_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "MockDrive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockDriveRound" ADD CONSTRAINT "MockDriveRound_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockDriveTarget" ADD CONSTRAINT "MockDriveTarget_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "MockDrive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockDriveTarget" ADD CONSTRAINT "MockDriveTarget_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockDriveRegistration" ADD CONSTRAINT "MockDriveRegistration_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "MockDrive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockDriveRegistration" ADD CONSTRAINT "MockDriveRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockRoundResult" ADD CONSTRAINT "MockRoundResult_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "MockDriveRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockRoundResult" ADD CONSTRAINT "MockRoundResult_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "MockDriveRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;


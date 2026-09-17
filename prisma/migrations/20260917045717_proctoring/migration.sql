-- CreateEnum
CREATE TYPE "ProctoringFlagType" AS ENUM ('NO_FACE', 'MULTIPLE_FACES', 'FACE_MISMATCH', 'TAB_SWITCH', 'FOCUS_LOSS', 'FULLSCREEN_EXIT', 'WINDOW_BLUR', 'WEBCAM_DENIED');

-- CreateEnum
CREATE TYPE "FlagSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "faceMatchThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
ADD COLUMN     "proctoringEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "snapshotIntervalSec" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "storeSnapshots" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ProctoringSession" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referencePhotoUrl" TEXT,
    "snapshotCount" INTEGER NOT NULL DEFAULT 0,
    "flagCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProctoringSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctoringFlag" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "ProctoringFlagType" NOT NULL,
    "severity" "FlagSeverity" NOT NULL DEFAULT 'LOW',
    "snapshotUrl" TEXT,
    "similarity" DOUBLE PRECISION,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProctoringFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProctoringSession_attemptId_key" ON "ProctoringSession"("attemptId");

-- CreateIndex
CREATE INDEX "ProctoringSession_userId_idx" ON "ProctoringSession"("userId");

-- CreateIndex
CREATE INDEX "ProctoringFlag_sessionId_idx" ON "ProctoringFlag"("sessionId");

-- CreateIndex
CREATE INDEX "ProctoringFlag_type_idx" ON "ProctoringFlag"("type");

-- AddForeignKey
ALTER TABLE "ProctoringSession" ADD CONSTRAINT "ProctoringSession_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringSession" ADD CONSTRAINT "ProctoringSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringFlag" ADD CONSTRAINT "ProctoringFlag_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProctoringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "CompetencyTier" AS ENUM ('CRITICAL_GAP', 'NEEDS_WORK', 'ON_TRACK', 'STRONG');

-- CreateEnum
CREATE TYPE "CompetencyTrend" AS ENUM ('IMPROVING', 'STABLE', 'DECLINING', 'INSUFFICIENT_DATA');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "practiceEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CompetencyInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dimensionType" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "dimensionName" TEXT NOT NULL,
    "sectionId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "tier" "CompetencyTier" NOT NULL,
    "belowAbsolute" BOOLEAN NOT NULL,
    "belowCohort" BOOLEAN NOT NULL,
    "trend" "CompetencyTrend" NOT NULL,
    "priority" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetencyInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetencyInsight_userId_orgId_priority_idx" ON "CompetencyInsight"("userId", "orgId", "priority");

-- CreateIndex
CREATE INDEX "CompetencyInsight_orgId_dimensionType_tier_idx" ON "CompetencyInsight"("orgId", "dimensionType", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyInsight_userId_orgId_dimensionType_dimensionId_key" ON "CompetencyInsight"("userId", "orgId", "dimensionType", "dimensionId");

-- CreateIndex
CREATE INDEX "PracticeRecommendation_userId_orgId_priority_idx" ON "PracticeRecommendation"("userId", "orgId", "priority");

-- AddForeignKey
ALTER TABLE "CompetencyInsight" ADD CONSTRAINT "CompetencyInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyInsight" ADD CONSTRAINT "CompetencyInsight_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeRecommendation" ADD CONSTRAINT "PracticeRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeRecommendation" ADD CONSTRAINT "PracticeRecommendation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeRecommendation" ADD CONSTRAINT "PracticeRecommendation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "SkillNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateEnum
CREATE TYPE "CompetencyScope" AS ENUM ('ASSESSMENT', 'DRIVE', 'CUMULATIVE');

-- CreateTable
CREATE TABLE "SectionCompetency" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "scope" "CompetencyScope" NOT NULL,
    "scopeRefId" TEXT NOT NULL,
    "questionsAttempted" INTEGER NOT NULL,
    "questionsCorrect" INTEGER NOT NULL,
    "rawAccuracy" DOUBLE PRECISION NOT NULL,
    "weightedScore" DOUBLE PRECISION NOT NULL,
    "marksEarned" DOUBLE PRECISION NOT NULL,
    "marksPossible" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionCompetency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillCompetency" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "scope" "CompetencyScope" NOT NULL,
    "scopeRefId" TEXT NOT NULL,
    "questionsAttempted" INTEGER NOT NULL,
    "questionsCorrect" INTEGER NOT NULL,
    "rawAccuracy" DOUBLE PRECISION NOT NULL,
    "weightedScore" DOUBLE PRECISION NOT NULL,
    "marksEarned" DOUBLE PRECISION NOT NULL,
    "marksPossible" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillCompetency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortBaseline" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "departmentId" TEXT,
    "batchYear" INTEGER,
    "dimensionType" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "avgAccuracy" DOUBLE PRECISION NOT NULL,
    "medianAccuracy" DOUBLE PRECISION NOT NULL,
    "p25Accuracy" DOUBLE PRECISION NOT NULL,
    "p75Accuracy" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SectionCompetency_userId_scope_idx" ON "SectionCompetency"("userId", "scope");

-- CreateIndex
CREATE INDEX "SectionCompetency_orgId_scope_sectionId_idx" ON "SectionCompetency"("orgId", "scope", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionCompetency_userId_orgId_sectionId_scope_scopeRefId_key" ON "SectionCompetency"("userId", "orgId", "sectionId", "scope", "scopeRefId");

-- CreateIndex
CREATE INDEX "SkillCompetency_userId_scope_idx" ON "SkillCompetency"("userId", "scope");

-- CreateIndex
CREATE INDEX "SkillCompetency_orgId_scope_skillId_idx" ON "SkillCompetency"("orgId", "scope", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillCompetency_userId_orgId_skillId_scope_scopeRefId_key" ON "SkillCompetency"("userId", "orgId", "skillId", "scope", "scopeRefId");

-- CreateIndex
CREATE INDEX "CohortBaseline_orgId_dimensionType_dimensionId_idx" ON "CohortBaseline"("orgId", "dimensionType", "dimensionId");

-- CreateIndex
CREATE INDEX "CohortBaseline_departmentId_idx" ON "CohortBaseline"("departmentId");

-- AddForeignKey
ALTER TABLE "SectionCompetency" ADD CONSTRAINT "SectionCompetency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionCompetency" ADD CONSTRAINT "SectionCompetency_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionCompetency" ADD CONSTRAINT "SectionCompetency_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TopicSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCompetency" ADD CONSTRAINT "SkillCompetency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCompetency" ADD CONSTRAINT "SkillCompetency_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCompetency" ADD CONSTRAINT "SkillCompetency_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "SkillNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortBaseline" ADD CONSTRAINT "CohortBaseline_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortBaseline" ADD CONSTRAINT "CohortBaseline_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;


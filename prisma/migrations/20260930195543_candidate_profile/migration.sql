-- CreateEnum
CREATE TYPE "ExperienceKind" AS ENUM ('INTERNSHIP', 'FULL_TIME', 'PART_TIME', 'FREELANCE');

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "about" TEXT,
    "city" TEXT,
    "rollNumber" TEXT,
    "degree" TEXT,
    "branch" TEXT,
    "graduationYear" INTEGER,
    "cgpa" DOUBLE PRECISION,
    "tenthPercent" DOUBLE PRECISION,
    "twelfthPercent" DOUBLE PRECISION,
    "activeBacklogs" INTEGER,
    "skills" TEXT[],
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "codingUrl" TEXT,
    "resumePath" TEXT,
    "resumeFileName" TEXT,
    "resumeUploadedAt" TIMESTAMP(3),
    "preferredRoles" TEXT[],
    "preferredLocations" TEXT[],
    "openToRelocate" BOOLEAN,
    "expectedCtcLpa" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateEducation" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "field" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "score" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "CandidateEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateExperience" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "kind" "ExperienceKind" NOT NULL DEFAULT 'INTERNSHIP',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "CandidateExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProject" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "techStack" TEXT[],
    "url" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "CandidateProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateAchievement" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "date" TIMESTAMP(3),
    "url" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "CandidateAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_userId_key" ON "CandidateProfile"("userId");

-- CreateIndex
CREATE INDEX "CandidateProfile_branch_idx" ON "CandidateProfile"("branch");

-- CreateIndex
CREATE INDEX "CandidateProfile_graduationYear_idx" ON "CandidateProfile"("graduationYear");

-- CreateIndex
CREATE INDEX "CandidateEducation_profileId_idx" ON "CandidateEducation"("profileId");

-- CreateIndex
CREATE INDEX "CandidateExperience_profileId_idx" ON "CandidateExperience"("profileId");

-- CreateIndex
CREATE INDEX "CandidateProject_profileId_idx" ON "CandidateProject"("profileId");

-- CreateIndex
CREATE INDEX "CandidateAchievement_profileId_idx" ON "CandidateAchievement"("profileId");

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateEducation" ADD CONSTRAINT "CandidateEducation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateExperience" ADD CONSTRAINT "CandidateExperience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProject" ADD CONSTRAINT "CandidateProject_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateAchievement" ADD CONSTRAINT "CandidateAchievement_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

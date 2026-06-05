-- CreateTable
CREATE TABLE "FitnessProfile" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startWeightKg" DOUBLE PRECISION NOT NULL,
    "goalWeightKg" DOUBLE PRECISION NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitnessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessWeightLog" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "sleepHours" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FitnessWeightLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessWorkoutSession" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "programId" TEXT,
    "programName" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FitnessWorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessDayProgress" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FitnessDayProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FitnessProfile_memberId_key" ON "FitnessProfile"("memberId");

-- CreateIndex
CREATE INDEX "FitnessProfile_memberId_idx" ON "FitnessProfile"("memberId");

-- CreateIndex
CREATE INDEX "FitnessProfile_tenantId_idx" ON "FitnessProfile"("tenantId");

-- CreateIndex
CREATE INDEX "FitnessWeightLog_memberId_date_idx" ON "FitnessWeightLog"("memberId", "date");

-- CreateIndex
CREATE INDEX "FitnessWorkoutSession_memberId_date_idx" ON "FitnessWorkoutSession"("memberId", "date");

-- CreateIndex
CREATE INDEX "FitnessDayProgress_memberId_idx" ON "FitnessDayProgress"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessDayProgress_memberId_weekIndex_dayIndex_key" ON "FitnessDayProgress"("memberId", "weekIndex", "dayIndex");

-- AddForeignKey
ALTER TABLE "FitnessProfile" ADD CONSTRAINT "FitnessProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessWeightLog" ADD CONSTRAINT "FitnessWeightLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessWorkoutSession" ADD CONSTRAINT "FitnessWorkoutSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessDayProgress" ADD CONSTRAINT "FitnessDayProgress_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

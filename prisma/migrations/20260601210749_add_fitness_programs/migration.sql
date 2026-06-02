-- CreateEnum
CREATE TYPE "FitnessProgramType" AS ENUM ('FULL_BODY', 'GAINAGE_ABDOS', 'JAMBES_FESSIERS', 'HAUT_CORPS', 'CUSTOM');

-- CreateTable
CREATE TABLE "FitnessProgram" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#C8FF00',
    "type" "FitnessProgramType" NOT NULL DEFAULT 'CUSTOM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitnessProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessExercise" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "repsOrDurationSec" INTEGER NOT NULL,
    "recoverySec" INTEGER NOT NULL DEFAULT 60,
    "muscles" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "tip" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitnessExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FitnessProgram_tenantId_idx" ON "FitnessProgram"("tenantId");

-- CreateIndex
CREATE INDEX "FitnessProgram_gymId_idx" ON "FitnessProgram"("gymId");

-- CreateIndex
CREATE INDEX "FitnessProgram_createdById_idx" ON "FitnessProgram"("createdById");

-- CreateIndex
CREATE INDEX "FitnessExercise_programId_idx" ON "FitnessExercise"("programId");

-- CreateIndex
CREATE INDEX "FitnessExercise_tenantId_idx" ON "FitnessExercise"("tenantId");

-- AddForeignKey
ALTER TABLE "FitnessProgram" ADD CONSTRAINT "FitnessProgram_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessProgram" ADD CONSTRAINT "FitnessProgram_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessProgram" ADD CONSTRAINT "FitnessProgram_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessExercise" ADD CONSTRAINT "FitnessExercise_programId_fkey" FOREIGN KEY ("programId") REFERENCES "FitnessProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessExercise" ADD CONSTRAINT "FitnessExercise_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

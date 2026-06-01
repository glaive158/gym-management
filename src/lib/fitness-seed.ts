// src/lib/fitness-seed.ts
import { PrismaClient } from "@prisma/client";
import { DEFAULT_PROGRAMS } from "@/lib/fitness-defaults";

export async function seedDefaultFitnessPrograms(args: {
  tenantId: string;
  gymId: string;
  prisma: PrismaClient;
}): Promise<void> {
  const { tenantId, gymId, prisma } = args;

  // Idempotency: skip gyms that already have default (manager/gym) programs.
  const existing = await prisma.fitnessProgram.count({
    where: { gymId, createdById: null },
  });
  if (existing > 0) return;

  // Atomic: all 4 default programs land together or none do. A mid-loop
  // failure rolls back fully, so a retry sees count 0 and re-seeds cleanly
  // instead of being skipped by the idempotency guard on a partial set.
  await prisma.$transaction(async (tx) => {
    for (const program of DEFAULT_PROGRAMS) {
      await tx.fitnessProgram.create({
        data: {
          tenantId,
          gymId,
          createdById: null,
          name: program.name,
          color: program.color,
          type: program.type,
          exercises: {
            create: program.exercises.map((ex, idx) => ({
              tenantId,
              name: ex.name,
              sets: ex.sets,
              repsOrDurationSec: ex.repsOrDurationSec,
              recoverySec: ex.recoverySec,
              muscles: ex.muscles,
              steps: ex.steps,
              tip: ex.tip,
              order: idx,
            })),
          },
        },
      });
    }
  });
}

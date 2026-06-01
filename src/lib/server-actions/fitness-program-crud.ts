// src/lib/server-actions/fitness-program-crud.ts
import { PrismaClient, FitnessProgramType } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

interface ExerciseInput {
  name: string;
  sets: number;
  repsOrDurationSec: number;
  recoverySec: number;
  muscles: string;
  steps: string[];
  tip?: string | null;
}

// Allow if manager editing a gym program, or member editing own private program.
async function assertCanEdit(
  prisma: PrismaClient,
  programId: string,
  tenantId: string,
  actorId: string,
  isManager: boolean,
): Promise<Result<{ createdById: string | null }>> {
  const program = await prisma.fitnessProgram.findFirst({
    where: { id: programId, tenantId },
    select: { createdById: true },
  });
  if (!program) return { success: false, error: "NOT_FOUND" };
  const allowed =
    (isManager && program.createdById === null) || program.createdById === actorId;
  if (!allowed) return { success: false, error: "FORBIDDEN" };
  return { success: true, data: program };
}

export async function listPrograms(args: {
  tenantId: string;
  gymId: string;
  memberId?: string;
  prisma: PrismaClient;
}) {
  const { tenantId, gymId, memberId, prisma } = args;
  const where = memberId
    ? { tenantId, gymId, isActive: true, OR: [{ createdById: null }, { createdById: memberId }] }
    : { tenantId, gymId, createdById: null };
  const data = await prisma.fitnessProgram.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { exercises: { orderBy: { order: "asc" } } },
  });
  return { success: true as const, data };
}

export async function createProgram(args: {
  tenantId: string;
  gymId: string;
  createdById: string | null;
  name: string;
  color: string;
  type: FitnessProgramType;
  prisma: PrismaClient;
}) {
  const { tenantId, gymId, createdById, name, color, type, prisma } = args;
  if (!name.trim()) return { success: false as const, error: "NAME_REQUIRED" };
  const data = await prisma.fitnessProgram.create({
    data: { tenantId, gymId, createdById, name: name.trim(), color, type },
  });
  return { success: true as const, data };
}

export async function updateProgram(args: {
  id: string;
  tenantId: string;
  actorId: string;
  isManager: boolean;
  name?: string;
  color?: string;
  type?: FitnessProgramType;
  isActive?: boolean;
  prisma: PrismaClient;
}) {
  const { id, tenantId, actorId, isManager, prisma, ...fields } = args;
  const can = await assertCanEdit(prisma, id, tenantId, actorId, isManager);
  if (!can.success) return can;
  const data = await prisma.fitnessProgram.update({
    where: { id },
    data: {
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.color !== undefined ? { color: fields.color } : {}),
      ...(fields.type !== undefined ? { type: fields.type } : {}),
      ...(fields.isActive !== undefined ? { isActive: fields.isActive } : {}),
    },
  });
  return { success: true as const, data };
}

export async function deleteProgram(args: {
  id: string;
  tenantId: string;
  actorId: string;
  isManager: boolean;
  prisma: PrismaClient;
}) {
  const { id, tenantId, actorId, isManager, prisma } = args;
  const can = await assertCanEdit(prisma, id, tenantId, actorId, isManager);
  if (!can.success) return can;
  await prisma.fitnessProgram.delete({ where: { id } });
  return { success: true as const, data: { id } };
}

export async function addExercise(args: {
  programId: string;
  tenantId: string;
  actorId: string;
  isManager: boolean;
  prisma: PrismaClient;
} & ExerciseInput) {
  const { programId, tenantId, actorId, isManager, prisma, ...ex } = args;
  const can = await assertCanEdit(prisma, programId, tenantId, actorId, isManager);
  if (!can.success) return can;
  const count = await prisma.fitnessExercise.count({ where: { programId } });
  const data = await prisma.fitnessExercise.create({
    data: {
      programId,
      tenantId,
      name: ex.name,
      sets: ex.sets,
      repsOrDurationSec: ex.repsOrDurationSec,
      recoverySec: ex.recoverySec,
      muscles: ex.muscles,
      steps: ex.steps,
      tip: ex.tip ?? null,
      order: count,
    },
  });
  return { success: true as const, data };
}

export async function updateExercise(args: {
  id: string;
  tenantId: string;
  actorId: string;
  isManager: boolean;
  prisma: PrismaClient;
} & Partial<ExerciseInput>) {
  const { id, tenantId, actorId, isManager, prisma, ...fields } = args;
  const exercise = await prisma.fitnessExercise.findFirst({
    where: { id, tenantId },
    select: { programId: true },
  });
  if (!exercise) return { success: false as const, error: "NOT_FOUND" };
  const can = await assertCanEdit(prisma, exercise.programId, tenantId, actorId, isManager);
  if (!can.success) return can;
  const data = await prisma.fitnessExercise.update({
    where: { id },
    data: {
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      ...(fields.sets !== undefined ? { sets: fields.sets } : {}),
      ...(fields.repsOrDurationSec !== undefined ? { repsOrDurationSec: fields.repsOrDurationSec } : {}),
      ...(fields.recoverySec !== undefined ? { recoverySec: fields.recoverySec } : {}),
      ...(fields.muscles !== undefined ? { muscles: fields.muscles } : {}),
      ...(fields.steps !== undefined ? { steps: fields.steps } : {}),
      ...(fields.tip !== undefined ? { tip: fields.tip } : {}),
    },
  });
  return { success: true as const, data };
}

export async function deleteExercise(args: {
  id: string;
  tenantId: string;
  actorId: string;
  isManager: boolean;
  prisma: PrismaClient;
}) {
  const { id, tenantId, actorId, isManager, prisma } = args;
  const exercise = await prisma.fitnessExercise.findFirst({
    where: { id, tenantId },
    select: { programId: true },
  });
  if (!exercise) return { success: false as const, error: "NOT_FOUND" };
  const can = await assertCanEdit(prisma, exercise.programId, tenantId, actorId, isManager);
  if (!can.success) return can;
  await prisma.fitnessExercise.delete({ where: { id } });
  return { success: true as const, data: { id } };
}

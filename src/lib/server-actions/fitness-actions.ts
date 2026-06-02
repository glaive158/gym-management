// src/lib/server-actions/fitness-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { FitnessProgramType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext } from "@/lib/auth-context";
import * as crud from "@/lib/server-actions/fitness-program-crud";

function unauthorized() {
  return { success: false as const, error: "UNAUTHORIZED" };
}

// ---- Manager actions (gym programs) ----

export async function managerCreateProgram(input: {
  name: string;
  color: string;
  type: FitnessProgramType;
}) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId || ctx.role !== Role.MANAGER) return unauthorized();
  const r = await crud.createProgram({
    tenantId: ctx.tenantId,
    gymId: ctx.gymId,
    createdById: null,
    name: input.name,
    color: input.color,
    type: input.type,
    prisma,
  });
  revalidatePath("/manager/fitness");
  return r;
}

export async function managerUpdateProgram(input: {
  id: string;
  name?: string;
  color?: string;
  type?: FitnessProgramType;
  isActive?: boolean;
}) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId || ctx.role !== Role.MANAGER) return unauthorized();
  const r = await crud.updateProgram({ ...input, tenantId: ctx.tenantId, gymId: ctx.gymId, actorId: ctx.userId, isManager: true, prisma });
  revalidatePath("/manager/fitness");
  return r;
}

export async function managerDeleteProgram(id: string) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId || ctx.role !== Role.MANAGER) return unauthorized();
  const r = await crud.deleteProgram({ id, tenantId: ctx.tenantId, gymId: ctx.gymId, actorId: ctx.userId, isManager: true, prisma });
  revalidatePath("/manager/fitness");
  return r;
}

export async function managerAddExercise(input: {
  programId: string; name: string; sets: number; repsOrDurationSec: number;
  recoverySec: number; muscles: string; steps: string[]; tip?: string | null;
}) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId || ctx.role !== Role.MANAGER) return unauthorized();
  const r = await crud.addExercise({ ...input, tenantId: ctx.tenantId, gymId: ctx.gymId, actorId: ctx.userId, isManager: true, prisma });
  revalidatePath(`/manager/fitness/${input.programId}`);
  return r;
}

export async function managerUpdateExercise(input: {
  id: string; name?: string; sets?: number; repsOrDurationSec?: number;
  recoverySec?: number; muscles?: string; steps?: string[]; tip?: string | null;
}) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId || ctx.role !== Role.MANAGER) return unauthorized();
  const r = await crud.updateExercise({ ...input, tenantId: ctx.tenantId, gymId: ctx.gymId, actorId: ctx.userId, isManager: true, prisma });
  revalidatePath("/manager/fitness");
  return r;
}

export async function managerDeleteExercise(id: string) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId || ctx.role !== Role.MANAGER) return unauthorized();
  const r = await crud.deleteExercise({ id, tenantId: ctx.tenantId, gymId: ctx.gymId, actorId: ctx.userId, isManager: true, prisma });
  revalidatePath("/manager/fitness");
  return r;
}

// ---- Member actions (private programs) ----

export async function memberCreateProgram(input: { name: string; color: string }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId || ctx.role !== Role.MEMBER) return unauthorized();
  const r = await crud.createProgram({
    tenantId: ctx.tenantId, gymId: ctx.gymId, createdById: ctx.userId,
    name: input.name, color: input.color, type: FitnessProgramType.CUSTOM, prisma,
  });
  revalidatePath("/me/fitness");
  return r;
}

export async function memberUpdateProgram(input: { id: string; name?: string; color?: string }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MEMBER) return unauthorized();
  const r = await crud.updateProgram({ ...input, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: false, prisma });
  revalidatePath("/me/fitness");
  return r;
}

export async function memberDeleteProgram(id: string) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MEMBER) return unauthorized();
  const r = await crud.deleteProgram({ id, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: false, prisma });
  revalidatePath("/me/fitness");
  return r;
}

export async function memberAddExercise(input: {
  programId: string; name: string; sets: number; repsOrDurationSec: number;
  recoverySec: number; muscles: string; steps: string[]; tip?: string | null;
}) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MEMBER) return unauthorized();
  const r = await crud.addExercise({ ...input, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: false, prisma });
  revalidatePath("/me/fitness");
  return r;
}

export async function memberDeleteExercise(id: string) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || ctx.role !== Role.MEMBER) return unauthorized();
  const r = await crud.deleteExercise({ id, tenantId: ctx.tenantId, actorId: ctx.userId, isManager: false, prisma });
  revalidatePath("/me/fitness");
  return r;
}

import type { PrismaClient } from "@prisma/client";
import { WEEKLY_SCHEDULE } from "@/lib/fitness-defaults";

type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export interface FitProfileDTO { startWeightKg: number; goalWeightKg: number; durationWeeks: number; startDate: string; }
export interface WeekDayDTO { type: string; label: string; durationMin: number | null; done: boolean }
export interface WeightDTO { date: string; weightKg: number }
export interface SleepDTO { date: string; hours: number }
export interface SessionDTO { date: string; programId: string; programName: string; durationMin: number }
export interface FitDataDTO { profile: FitProfileDTO | null; weekData: WeekDayDTO[][]; weights: WeightDTO[]; sleeps: SleepDTO[]; sessions: SessionDTO[]; }

function ok<T>(data: T) { return { success: true as const, data }; }
function err(error: string) { return { success: false as const, error }; }

export async function getFitnessData(args: { memberId: string; tenantId: string; prisma: PrismaClient; }): Promise<{ success: true; data: FitDataDTO } | { success: false; error: string }> {
  const { memberId, tenantId, prisma } = args;
  const profile = await prisma.fitnessProfile.findFirst({ where: { memberId, tenantId } });
  const weightRows = await prisma.fitnessWeightLog.findMany({ where: { memberId, tenantId }, orderBy: { date: "asc" } });
  const sessionRows = await prisma.fitnessWorkoutSession.findMany({ where: { memberId, tenantId }, orderBy: { date: "desc" } });
  const progressRows = await prisma.fitnessDayProgress.findMany({ where: { memberId, tenantId } });

  const weights: WeightDTO[] = weightRows.map((w) => ({ date: w.date.toISOString(), weightKg: w.weightKg }));
  const sleeps: SleepDTO[] = weightRows.filter((w) => w.sleepHours != null).map((w) => ({ date: w.date.toISOString(), hours: w.sleepHours as number }));
  const sessions: SessionDTO[] = sessionRows.map((s) => ({ date: s.date.toISOString(), programId: s.programId ?? s.kind, programName: s.programName, durationMin: s.durationMin }));

  let weekData: WeekDayDTO[][] = [];
  if (profile) {
    const doneMap = new Map<string, boolean>();
    for (const p of progressRows) doneMap.set(`${p.weekIndex}-${p.dayIndex}`, p.done);
    weekData = Array.from({ length: profile.durationWeeks }, (_, wi) =>
      WEEKLY_SCHEDULE.map((d, di) => ({ type: d.type, label: d.label, durationMin: d.durationMin, done: doneMap.get(`${wi}-${di}`) ?? false })),
    );
  }

  return ok({
    profile: profile ? { startWeightKg: profile.startWeightKg, goalWeightKg: profile.goalWeightKg, durationWeeks: profile.durationWeeks, startDate: profile.startDate.toISOString() } : null,
    weekData, weights, sleeps, sessions,
  });
}

export async function upsertProfile(args: { memberId: string; tenantId: string; startWeightKg: number; goalWeightKg: number; durationWeeks: number; startDate: string; prisma: PrismaClient; }) {
  const { memberId, tenantId, startWeightKg, goalWeightKg, durationWeeks, startDate, prisma } = args;
  if (![4, 8, 12].includes(durationWeeks)) return err("DUREE_INVALIDE");
  if (!(startWeightKg > 0) || !(goalWeightKg > 0)) return err("POIDS_INVALIDE");

  await prisma.$transaction(async (tx: Tx) => {
    const existing = await tx.fitnessProfile.findFirst({ where: { memberId, tenantId } });
    await tx.fitnessProfile.upsert({
      where: { memberId },
      create: { memberId, tenantId, startWeightKg, goalWeightKg, durationWeeks, startDate: new Date(startDate) },
      update: { startWeightKg, goalWeightKg, durationWeeks, startDate: new Date(startDate) },
    });
    if (!existing) {
      const rows = [];
      for (let wi = 0; wi < durationWeeks; wi++) {
        for (let di = 0; di < WEEKLY_SCHEDULE.length; di++) {
          rows.push({ memberId, tenantId, weekIndex: wi, dayIndex: di, done: false });
        }
      }
      await tx.fitnessDayProgress.createMany({ data: rows });
    }
  });
  return ok({ memberId });
}

export async function addWeightLog(args: { memberId: string; tenantId: string; date: string; weightKg: number; sleepHours?: number | null; prisma: PrismaClient; }) {
  const { memberId, tenantId, date, weightKg, sleepHours, prisma } = args;
  if (!(weightKg > 0)) return err("POIDS_INVALIDE");
  await prisma.fitnessWeightLog.create({ data: { memberId, tenantId, date: new Date(date), weightKg, sleepHours: sleepHours ?? null } });
  return ok({ memberId });
}

export async function addWorkoutSession(args: { memberId: string; tenantId: string; date: string; programId?: string | null; programName: string; durationMin: number; kind: string; prisma: PrismaClient; }) {
  const { memberId, tenantId, date, programId, programName, durationMin, kind, prisma } = args;
  if (!programName.trim()) return err("NOM_REQUIS");
  await prisma.fitnessWorkoutSession.create({ data: { memberId, tenantId, date: new Date(date), programId: programId ?? null, programName: programName.trim(), durationMin, kind } });
  return ok({ memberId });
}

export async function toggleDayProgress(args: { memberId: string; tenantId: string; weekIndex: number; dayIndex: number; prisma: PrismaClient; }) {
  const { memberId, tenantId, weekIndex, dayIndex, prisma } = args;
  const row = await prisma.fitnessDayProgress.findFirst({ where: { memberId, tenantId, weekIndex, dayIndex } });
  if (!row) return err("INTROUVABLE");
  await prisma.fitnessDayProgress.update({ where: { id: row.id }, data: { done: !row.done } });
  return ok({ done: !row.done });
}

import { describe, it, expect, beforeEach } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import {
  getFitnessData,
  upsertProfile,
  addWeightLog,
  addWorkoutSession,
  toggleDayProgress,
} from "@/lib/server-actions/fitness-tracking";

async function seedMember() {
  const tenant = await testPrisma.tenant.create({
    data: { name: "T", slug: `t-${Math.random().toString(36).slice(2)}`, status: "ACTIVE", ownerEmail: `owner-${Math.random().toString(36).slice(2)}@test.com`, ownerPhone: "771234567", city: "Dakar" },
  });
  const gym = await testPrisma.gym.create({
    data: { tenantId: tenant.id, name: "G", address: "a", city: "Dakar", phone: "1", latitude: 14.6, longitude: -17.4 },
  });
  const member = await testPrisma.user.create({
    data: { name: "M", email: `m-${Math.random().toString(36).slice(2)}@test.com`, passwordHash: "x", role: "MEMBER", tenantId: tenant.id, gymId: gym.id },
  });
  return { tenantId: tenant.id, gymId: gym.id, memberId: member.id };
}

describe("fitness-tracking", () => {
  beforeEach(async () => { await resetDb(); });

  it("upsertProfile creates durationWeeks*7 day-progress rows", async () => {
    const { tenantId, memberId } = await seedMember();
    const r = await upsertProfile({
      memberId, tenantId, startWeightKg: 80, goalWeightKg: 72,
      durationWeeks: 4, startDate: "2026-06-01T00:00:00.000Z", prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const count = await testPrisma.fitnessDayProgress.count({ where: { memberId } });
    expect(count).toBe(28);
  });

  it("upsertProfile regenerates day-progress on duration change, preserving done flags", async () => {
    const { tenantId, memberId } = await seedMember();
    await upsertProfile({ memberId, tenantId, startWeightKg: 80, goalWeightKg: 72, durationWeeks: 4, startDate: "2026-06-01T00:00:00.000Z", prisma: testPrisma });
    await toggleDayProgress({ memberId, tenantId, weekIndex: 0, dayIndex: 0, prisma: testPrisma });
    // grow 4 -> 12 weeks
    await upsertProfile({ memberId, tenantId, startWeightKg: 80, goalWeightKg: 72, durationWeeks: 12, startDate: "2026-06-01T00:00:00.000Z", prisma: testPrisma });
    expect(await testPrisma.fitnessDayProgress.count({ where: { memberId } })).toBe(84);
    // existing done flag preserved
    const day0 = await testPrisma.fitnessDayProgress.findFirst({ where: { memberId, weekIndex: 0, dayIndex: 0 } });
    expect(day0?.done).toBe(true);
    // new weeks are toggleable (not INTROUVABLE)
    const t = await toggleDayProgress({ memberId, tenantId, weekIndex: 11, dayIndex: 6, prisma: testPrisma });
    expect(t.success).toBe(true);
    // shrink 12 -> 4 removes extra rows
    await upsertProfile({ memberId, tenantId, startWeightKg: 80, goalWeightKg: 72, durationWeeks: 4, startDate: "2026-06-01T00:00:00.000Z", prisma: testPrisma });
    expect(await testPrisma.fitnessDayProgress.count({ where: { memberId } })).toBe(28);
  });

  it("getFitnessData returns empty shape when no profile", async () => {
    const { tenantId, memberId } = await seedMember();
    const r = await getFitnessData({ memberId, tenantId, prisma: testPrisma });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.profile).toBeNull();
    expect(r.data.weights).toEqual([]);
    expect(r.data.sessions).toEqual([]);
    expect(r.data.weekData).toEqual([]);
  });

  it("addWeightLog + addWorkoutSession surface in getFitnessData", async () => {
    const { tenantId, memberId } = await seedMember();
    await addWeightLog({ memberId, tenantId, date: "2026-06-02T00:00:00.000Z", weightKg: 79.5, sleepHours: 7, prisma: testPrisma });
    await addWorkoutSession({ memberId, tenantId, date: "2026-06-02T00:00:00.000Z", programId: null, programName: "Marche", durationMin: 30, kind: "marche", prisma: testPrisma });
    const r = await getFitnessData({ memberId, tenantId, prisma: testPrisma });
    expect(r.success && r.data.weights.length).toBe(1);
    expect(r.success && r.data.sleeps.length).toBe(1);
    expect(r.success && r.data.sessions.length).toBe(1);
    expect(r.success && r.data.sessions[0].programName).toBe("Marche");
  });

  it("toggleDayProgress flips done flag", async () => {
    const { tenantId, memberId } = await seedMember();
    await upsertProfile({ memberId, tenantId, startWeightKg: 80, goalWeightKg: 72, durationWeeks: 4, startDate: "2026-06-01T00:00:00.000Z", prisma: testPrisma });
    await toggleDayProgress({ memberId, tenantId, weekIndex: 0, dayIndex: 0, prisma: testPrisma });
    const r = await getFitnessData({ memberId, tenantId, prisma: testPrisma });
    expect(r.success && r.data.weekData[0][0].done).toBe(true);
    await toggleDayProgress({ memberId, tenantId, weekIndex: 0, dayIndex: 0, prisma: testPrisma });
    const r2 = await getFitnessData({ memberId, tenantId, prisma: testPrisma });
    expect(r2.success && r2.data.weekData[0][0].done).toBe(false);
  });

  it("tenant isolation: member never sees another tenant's data", async () => {
    const a = await seedMember();
    const b = await seedMember();
    await addWeightLog({ memberId: a.memberId, tenantId: a.tenantId, date: "2026-06-02T00:00:00.000Z", weightKg: 79.5, prisma: testPrisma });
    const r = await getFitnessData({ memberId: a.memberId, tenantId: b.tenantId, prisma: testPrisma });
    expect(r.success && r.data.weights.length).toBe(0);
  });
});

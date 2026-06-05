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

  it("getFitnessData returns empty shape when no profile", async () => {
    const { tenantId, memberId } = await seedMember();
    const r = await getFitnessData({ memberId, tenantId, prisma: testPrisma });
    expect(r.success).toBe(true);
    expect(r.data.profile).toBeNull();
    expect(r.data.weights).toEqual([]);
    expect(r.data.sessions).toEqual([]);
    expect(r.data.weekData).toEqual([]);
  });
});

// tests/lib/fitness-seed.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../helpers/db";
import { seedDefaultFitnessPrograms } from "@/lib/fitness-seed";
import { TenantStatus } from "@prisma/client";

async function seedGym() {
  const tenant = await testPrisma.tenant.create({
    data: { name: "T", slug: `t-${Date.now()}-${Math.random()}`, ownerEmail: "a@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const gym = await testPrisma.gym.create({
    data: { tenantId: tenant.id, name: "G", address: "x", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  return { tenant, gym };
}

describe("seedDefaultFitnessPrograms", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates 4 gym programs with createdById null", async () => {
    const { tenant, gym } = await seedGym();
    await seedDefaultFitnessPrograms({ tenantId: tenant.id, gymId: gym.id, prisma: testPrisma });
    const programs = await testPrisma.fitnessProgram.findMany({ where: { gymId: gym.id } });
    expect(programs).toHaveLength(4);
    expect(programs.every((p) => p.createdById === null)).toBe(true);
  });

  it("creates 6 exercises per program", async () => {
    const { tenant, gym } = await seedGym();
    await seedDefaultFitnessPrograms({ tenantId: tenant.id, gymId: gym.id, prisma: testPrisma });
    const exercises = await testPrisma.fitnessExercise.findMany();
    expect(exercises).toHaveLength(24);
  });

  it("is idempotent — does not duplicate on second call", async () => {
    const { tenant, gym } = await seedGym();
    await seedDefaultFitnessPrograms({ tenantId: tenant.id, gymId: gym.id, prisma: testPrisma });
    await seedDefaultFitnessPrograms({ tenantId: tenant.id, gymId: gym.id, prisma: testPrisma });
    const programs = await testPrisma.fitnessProgram.findMany({ where: { gymId: gym.id } });
    expect(programs).toHaveLength(4);
  });
});

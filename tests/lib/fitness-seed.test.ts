// tests/lib/fitness-seed.test.ts
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
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

  it("rolls back fully when seeding fails mid-way (no partial set)", async () => {
    const { tenant, gym } = await seedGym();

    // Inject a defaults list whose 3rd program has an invalid enum type so the
    // 3rd create throws after the first two succeed inside the transaction.
    vi.resetModules();
    vi.doMock("@/lib/fitness-defaults", () => ({
      DEFAULT_PROGRAMS: [
        { name: "A", color: "#fff", type: "FULL_BODY", exercises: [] },
        { name: "B", color: "#fff", type: "GAINAGE_ABDOS", exercises: [] },
        { name: "C", color: "#fff", type: "NOT_A_REAL_TYPE", exercises: [] },
        { name: "D", color: "#fff", type: "HAUT_CORPS", exercises: [] },
      ],
    }));
    const { seedDefaultFitnessPrograms: seedMocked } = await import("@/lib/fitness-seed");

    await expect(
      seedMocked({ tenantId: tenant.id, gymId: gym.id, prisma: testPrisma }),
    ).rejects.toThrow();

    const programs = await testPrisma.fitnessProgram.findMany({ where: { gymId: gym.id } });
    expect(programs).toHaveLength(0);

    vi.doUnmock("@/lib/fitness-defaults");
    vi.resetModules();
  });
});

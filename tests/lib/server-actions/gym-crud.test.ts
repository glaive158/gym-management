import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createGym, updateGym, listGyms, deleteGym } from "@/lib/server-actions/gym-crud";
import { TenantStatus } from "@prisma/client";

async function seedTenant(opts: { quota?: number } = {}) {
  return testPrisma.tenant.create({
    data: {
      name: "FitClub", slug: `fitclub-${Date.now()}-${Math.random()}`, ownerEmail: "a@x.com",
      ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE,
      gymQuota: opts.quota ?? 10,
    },
  });
}

const validInput = {
  name: "FitClub Plateau", address: "rue X", city: "Dakar",
  phone: "+221770000000", latitude: 14.7, longitude: -17.4,
};

describe("createGym", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("creates a gym scoped to tenant", async () => {
    const t = await seedTenant();
    const r = await createGym({ tenantId: t.id, ...validInput, prisma: testPrisma });
    expect(r.success).toBe(true);
    const gyms = await testPrisma.gym.findMany();
    expect(gyms).toHaveLength(1);
    expect(gyms[0].tenantId).toBe(t.id);
  });

  it("rejects invalid coordinates", async () => {
    const t = await seedTenant();
    const r = await createGym({ tenantId: t.id, ...validInput, latitude: 999, prisma: testPrisma });
    expect(r.success).toBe(false);
  });

  it("rejects empty name", async () => {
    const t = await seedTenant();
    const r = await createGym({ tenantId: t.id, ...validInput, name: "", prisma: testPrisma });
    expect(r.success).toBe(false);
  });

  it("rejects when the tenant gym quota is reached", async () => {
    const t = await seedTenant({ quota: 1 });
    const first = await createGym({ tenantId: t.id, ...validInput, name: "G1", prisma: testPrisma });
    expect(first.success).toBe(true);
    const second = await createGym({ tenantId: t.id, ...validInput, name: "G2", prisma: testPrisma });
    expect(second.success).toBe(false);
    expect(second.error).toBe("QUOTA_REACHED");
  });

  it("seeds 4 default fitness programs", async () => {
    const t = await seedTenant();
    const r = await createGym({ tenantId: t.id, ...validInput, prisma: testPrisma });
    expect(r.success).toBe(true);
    const gym = (await testPrisma.gym.findFirst({ where: { tenantId: t.id } }))!;
    const programs = await testPrisma.fitnessProgram.findMany({ where: { gymId: gym.id } });
    expect(programs).toHaveLength(4);
  });
});

describe("listGyms", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("returns all gyms of a tenant ordered by name", async () => {
    const t = await seedTenant();
    await createGym({ tenantId: t.id, ...validInput, name: "Zeta", prisma: testPrisma });
    await createGym({ tenantId: t.id, ...validInput, name: "Alpha", prisma: testPrisma });
    const gyms = await listGyms({ tenantId: t.id, prisma: testPrisma });
    expect(gyms.map(g => g.name)).toEqual(["Alpha", "Zeta"]);
  });
});

describe("updateGym", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("updates a gym's name and phone", async () => {
    const t = await seedTenant();
    const c = await createGym({ tenantId: t.id, ...validInput, prisma: testPrisma });
    const r = await updateGym({
      tenantId: t.id, gymId: c.gymId!,
      name: "New Name", phone: "+221779999999", prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const updated = await testPrisma.gym.findUniqueOrThrow({ where: { id: c.gymId! } });
    expect(updated.name).toBe("New Name");
    expect(updated.phone).toBe("+221779999999");
  });

  it("rejects update of a gym from another tenant", async () => {
    const t1 = await seedTenant();
    const t2 = await testPrisma.tenant.create({
      data: { name: "B", slug: "b", ownerEmail: "b@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
    });
    const c = await createGym({ tenantId: t2.id, ...validInput, prisma: testPrisma });
    const r = await updateGym({
      tenantId: t1.id, gymId: c.gymId!,
      name: "Hack", prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });
});

describe("deleteGym", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("deletes a gym of the tenant", async () => {
    const t = await seedTenant();
    const c = await createGym({ tenantId: t.id, ...validInput, prisma: testPrisma });
    const r = await deleteGym({ tenantId: t.id, gymId: c.gymId!, prisma: testPrisma });
    expect(r.success).toBe(true);
    const gyms = await testPrisma.gym.findMany();
    expect(gyms).toHaveLength(0);
  });
});

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../helpers/db";
import { tenantPrisma, platformPrisma } from "@/lib/prisma-tenant";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

async function seedTwoTenants() {
  const tA = await testPrisma.tenant.create({
    data: { name: "TenantA", slug: "tenant-a", ownerEmail: "a@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const tB = await testPrisma.tenant.create({
    data: { name: "TenantB", slug: "tenant-b", ownerEmail: "b@x.com", ownerPhone: "2", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const gA = await testPrisma.gym.create({
    data: { tenantId: tA.id, name: "GymA1", address: "addr", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  const gB = await testPrisma.gym.create({
    data: { tenantId: tB.id, name: "GymB1", address: "addr", city: "Dakar", phone: "2", latitude: 14.7, longitude: -17.4 },
  });
  return { tA, tB, gA, gB };
}

describe("tenantPrisma isolation", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("findMany on Gym only returns rows for the scoped tenant", async () => {
    const { tA } = await seedTwoTenants();
    const client = tenantPrisma(testPrisma, tA.id);
    const gyms = await client.gym.findMany();
    expect(gyms).toHaveLength(1);
    expect(gyms[0].tenantId).toBe(tA.id);
  });

  it("findUnique on Gym returns null when the row belongs to a different tenant", async () => {
    const { tA, gB } = await seedTwoTenants();
    const client = tenantPrisma(testPrisma, tA.id);
    const gym = await client.gym.findUnique({ where: { id: gB.id } });
    expect(gym).toBeNull();
  });

  it("create on Gym forces the scoped tenantId even if caller passes another", async () => {
    const { tA, tB } = await seedTwoTenants();
    const client = tenantPrisma(testPrisma, tA.id);
    const gym = await client.gym.create({
      data: { tenantId: tB.id, name: "Hack", address: "x", city: "x", phone: "1", latitude: 0, longitude: 0 },
    });
    expect(gym.tenantId).toBe(tA.id);
  });

  it("update on Gym refuses to touch rows from another tenant", async () => {
    const { tA, gB } = await seedTwoTenants();
    const client = tenantPrisma(testPrisma, tA.id);
    await expect(
      client.gym.update({ where: { id: gB.id }, data: { name: "Pwned" } })
    ).rejects.toThrow();
  });

  it("delete on Gym refuses to delete rows from another tenant", async () => {
    const { tA, gB } = await seedTwoTenants();
    const client = tenantPrisma(testPrisma, tA.id);
    await expect(client.gym.delete({ where: { id: gB.id } })).rejects.toThrow();
    const stillThere = await testPrisma.gym.findUnique({ where: { id: gB.id } });
    expect(stillThere).not.toBeNull();
  });

  it("count on User only counts users of the scoped tenant", async () => {
    const { tA, tB } = await seedTwoTenants();
    await testPrisma.user.createMany({
      data: [
        { name: "A1", email: "a1@x.com", passwordHash: "x", role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tA.id },
        { name: "A2", email: "a2@x.com", passwordHash: "x", role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tA.id },
        { name: "B1", email: "b1@x.com", passwordHash: "x", role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tB.id },
      ],
    });
    const client = tenantPrisma(testPrisma, tA.id);
    expect(await client.user.count()).toBe(2);
  });
});

describe("platformPrisma bypass", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("sees every tenant's rows (no scoping)", async () => {
    await seedTwoTenants();
    const client = platformPrisma(testPrisma);
    const gyms = await client.gym.findMany();
    expect(gyms).toHaveLength(2);
  });
});

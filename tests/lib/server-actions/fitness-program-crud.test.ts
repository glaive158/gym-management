// tests/lib/server-actions/fitness-program-crud.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import {
  listPrograms, createProgram, updateProgram, deleteProgram,
  addExercise, updateExercise, deleteExercise,
} from "@/lib/server-actions/fitness-program-crud";
import { Role, TenantStatus } from "@prisma/client";

async function seed() {
  const tenant = await testPrisma.tenant.create({
    data: { name: "T", slug: `t-${Date.now()}-${Math.random()}`, ownerEmail: "a@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const gym = await testPrisma.gym.create({
    data: { tenantId: tenant.id, name: "G", address: "x", city: "Dakar", phone: "1", latitude: 14.7, longitude: -17.4 },
  });
  const member = await testPrisma.user.create({
    data: { name: "M", role: Role.MEMBER, tenantId: tenant.id, gymId: gym.id },
  });
  const other = await testPrisma.user.create({
    data: { name: "O", role: Role.MEMBER, tenantId: tenant.id, gymId: gym.id },
  });
  return { tenant, gym, member, other };
}

const exFields = { name: "Squat", sets: 3, repsOrDurationSec: 15, recoverySec: 60, muscles: "Jambes", steps: ["a", "b"], tip: "ok" };

describe("createProgram + listPrograms", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("manager creates a gym program (createdById null)", async () => {
    const { tenant, gym } = await seed();
    const r = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: null, name: "P", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    expect(r.success).toBe(true);
    const list = await listPrograms({ tenantId: tenant.id, gymId: gym.id, prisma: testPrisma });
    expect(list.success && list.data).toHaveLength(1);
  });

  it("member sees gym programs + own private but NOT others' private", async () => {
    const { tenant, gym, member, other } = await seed();
    await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: null, name: "Gym", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: member.id, name: "Mine", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: other.id, name: "Theirs", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const list = await listPrograms({ tenantId: tenant.id, gymId: gym.id, memberId: member.id, prisma: testPrisma });
    const names = list.success ? list.data.map((p) => p.name).sort() : [];
    expect(names).toEqual(["Gym", "Mine"]);
  });
});

describe("ownership on update/delete", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("member cannot edit a gym program", async () => {
    const { tenant, gym, member } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: null, name: "Gym", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const id = c.success ? c.data.id : "";
    const r = await updateProgram({ id, tenantId: tenant.id, actorId: member.id, isManager: false, name: "Hack", prisma: testPrisma });
    expect(r.success).toBe(false);
    expect(!r.success && r.error).toBe("FORBIDDEN");
  });

  it("member cannot edit another member's private program", async () => {
    const { tenant, gym, member, other } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: other.id, name: "Theirs", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const id = c.success ? c.data.id : "";
    const r = await deleteProgram({ id, tenantId: tenant.id, actorId: member.id, isManager: false, prisma: testPrisma });
    expect(!r.success && r.error).toBe("FORBIDDEN");
  });

  it("member edits own private program", async () => {
    const { tenant, gym, member } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: member.id, name: "Mine", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const id = c.success ? c.data.id : "";
    const r = await updateProgram({ id, tenantId: tenant.id, actorId: member.id, isManager: false, name: "Mine2", prisma: testPrisma });
    expect(r.success).toBe(true);
  });

  it("manager edits a gym program", async () => {
    const { tenant, gym } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: null, name: "Gym", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const id = c.success ? c.data.id : "";
    const r = await updateProgram({ id, tenantId: tenant.id, actorId: "mgr", isManager: true, name: "Gym2", prisma: testPrisma });
    expect(r.success).toBe(true);
  });
});

describe("exercise CRUD", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("adds, updates, deletes an exercise on own program", async () => {
    const { tenant, gym, member } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: member.id, name: "Mine", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const programId = c.success ? c.data.id : "";
    const add = await addExercise({ programId, tenantId: tenant.id, actorId: member.id, isManager: false, ...exFields, prisma: testPrisma });
    expect(add.success).toBe(true);
    const exId = add.success ? add.data.id : "";
    const upd = await updateExercise({ id: exId, tenantId: tenant.id, actorId: member.id, isManager: false, name: "Squat2", prisma: testPrisma });
    expect(upd.success).toBe(true);
    const del = await deleteExercise({ id: exId, tenantId: tenant.id, actorId: member.id, isManager: false, prisma: testPrisma });
    expect(del.success).toBe(true);
    const left = await testPrisma.fitnessExercise.count({ where: { programId } });
    expect(left).toBe(0);
  });

  it("blocks adding an exercise to a gym program as member", async () => {
    const { tenant, gym, member } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: null, name: "Gym", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const programId = c.success ? c.data.id : "";
    const add = await addExercise({ programId, tenantId: tenant.id, actorId: member.id, isManager: false, ...exFields, prisma: testPrisma });
    expect(!add.success && add.error).toBe("FORBIDDEN");
  });
});

describe("per-gym isolation within a tenant", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("manager of gym B cannot edit gym A's program in the same tenant", async () => {
    const { tenant, gym } = await seed();
    const gymB = await testPrisma.gym.create({
      data: { tenantId: tenant.id, name: "GB", address: "y", city: "Dakar", phone: "2", latitude: 14.8, longitude: -17.5 },
    });
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: null, name: "GymA", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const id = c.success ? c.data.id : "";
    // Manager scoped to gym B passes gymId B → program belongs to gym A → not found.
    const r = await updateProgram({ id, tenantId: tenant.id, gymId: gymB.id, actorId: "mgrB", isManager: true, name: "Hack", prisma: testPrisma });
    expect(!r.success && r.error).toBe("NOT_FOUND");
  });

  it("manager of gym A can edit gym A's program when gymId matches", async () => {
    const { tenant, gym } = await seed();
    const c = await createProgram({ tenantId: tenant.id, gymId: gym.id, createdById: null, name: "GymA", color: "#fff", type: "CUSTOM", prisma: testPrisma });
    const id = c.success ? c.data.id : "";
    const r = await updateProgram({ id, tenantId: tenant.id, gymId: gym.id, actorId: "mgrA", isManager: true, name: "GymA2", prisma: testPrisma });
    expect(r.success).toBe(true);
  });
});

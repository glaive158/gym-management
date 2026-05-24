import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createMember, listMembers, getMember, updateMember } from "@/lib/server-actions/member-crud";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

async function seed() {
  return testPrisma.tenant.create({
    data: { name: "F", slug: "f", ownerEmail: "a@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
  });
}

afterAll(async () => { await testPrisma.$disconnect(); });

describe("createMember", () => {
  beforeEach(async () => { await resetDb(); });

  it("creates a MEMBER ACTIVE with passwordless account", async () => {
    const t = await seed();
    const r = await createMember({
      tenantId: t.id,
      name: "Aliou", email: "aliou@x.com", phone: "+221770000000",
      avatar: "/uploads/avatar1.jpg",
      prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const u = await testPrisma.user.findUniqueOrThrow({ where: { email: "aliou@x.com" } });
    expect(u.role).toBe(Role.MEMBER);
    expect(u.status).toBe(UserStatus.ACTIVE);
    expect(u.tenantId).toBe(t.id);
    expect(u.avatar).toBe("/uploads/avatar1.jpg");
    expect(u.activationToken).not.toBeNull();
  });

  it("rejects without avatar (required for anti-fraud)", async () => {
    const t = await seed();
    const r = await createMember({
      tenantId: t.id,
      name: "Aliou", email: "a@x.com", phone: "+221770000000",
      avatar: "",
      prisma: testPrisma,
    });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/photo|avatar/i);
  });

  it("rejects duplicate email", async () => {
    const t = await seed();
    await createMember({
      tenantId: t.id, name: "A", email: "a@x.com", phone: "+221770000001",
      avatar: "/uploads/x.jpg", prisma: testPrisma,
    });
    const r = await createMember({
      tenantId: t.id, name: "B", email: "a@x.com", phone: "+221770000002",
      avatar: "/uploads/y.jpg", prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });
});

describe("listMembers", () => {
  beforeEach(async () => { await resetDb(); });

  it("returns members of a tenant only ordered by name", async () => {
    const t = await seed();
    await createMember({ tenantId: t.id, name: "Beta", email: "b@x.com", phone: "+221770000001", avatar: "/uploads/b.jpg", prisma: testPrisma });
    await createMember({ tenantId: t.id, name: "Alpha", email: "a@x.com", phone: "+221770000002", avatar: "/uploads/a.jpg", prisma: testPrisma });
    const list = await listMembers({ tenantId: t.id, prisma: testPrisma });
    expect(list.map(m => m.name)).toEqual(["Alpha", "Beta"]);
  });

  it("filters by search query (name / email / phone)", async () => {
    const t = await seed();
    await createMember({ tenantId: t.id, name: "Aliou Diop", email: "aliou@x.com", phone: "+221770000001", avatar: "/uploads/a.jpg", prisma: testPrisma });
    await createMember({ tenantId: t.id, name: "Fatou Ndiaye", email: "fatou@x.com", phone: "+221770000002", avatar: "/uploads/b.jpg", prisma: testPrisma });
    const r = await listMembers({ tenantId: t.id, search: "fatou", prisma: testPrisma });
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("Fatou Ndiaye");
  });
});

describe("getMember", () => {
  beforeEach(async () => { await resetDb(); });

  it("returns null when member not in tenant", async () => {
    const t = await seed();
    const t2 = await testPrisma.tenant.create({
      data: { name: "T2", slug: "t2", ownerEmail: "b@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
    });
    const c = await createMember({
      tenantId: t2.id, name: "X", email: "x@x.com", phone: "+221770000001",
      avatar: "/uploads/x.jpg", prisma: testPrisma,
    });
    const r = await getMember({ tenantId: t.id, memberId: c.userId!, prisma: testPrisma });
    expect(r).toBeNull();
  });
});

describe("updateMember", () => {
  beforeEach(async () => { await resetDb(); });

  it("updates name + phone", async () => {
    const t = await seed();
    const c = await createMember({
      tenantId: t.id, name: "A", email: "a@x.com", phone: "+221770000001",
      avatar: "/uploads/a.jpg", prisma: testPrisma,
    });
    const r = await updateMember({
      tenantId: t.id, memberId: c.userId!,
      name: "Aliou Diop", phone: "+221770000099",
      prisma: testPrisma,
    });
    expect(r.success).toBe(true);
    const u = await testPrisma.user.findUniqueOrThrow({ where: { id: c.userId! } });
    expect(u.name).toBe("Aliou Diop");
    expect(u.phone).toBe("+221770000099");
  });
});

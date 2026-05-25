import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { loginMobile } from "@/lib/server-actions/mobile-auth";
import { hashPassword } from "@/lib/password";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

const SECRET = "test-secret-must-be-long-enough-for-hs256";

async function seedMember(password = "Hunter2Pass!") {
  const tenant = await testPrisma.tenant.create({
    data: { name: "T", slug: `t${Date.now()}${Math.random()}`, ownerEmail: "o@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
  });
  const hash = await hashPassword(password);
  return testPrisma.user.create({
    data: { name: "M", email: `m${Date.now()}${Math.random()}@x.com`, passwordHash: hash, role: Role.MEMBER, status: UserStatus.ACTIVE, tenantId: tenant.id },
  });
}

describe("loginMobile", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await testPrisma.$disconnect(); });

  it("returns token + user on valid creds", async () => {
    const u = await seedMember();
    const r = await loginMobile({ email: u.email, password: "Hunter2Pass!", secret: SECRET, prisma: testPrisma });
    expect(r.success).toBe(true);
    expect(r.token).toBeTruthy();
    expect(r.user?.id).toBe(u.id);
  });

  it("rejects wrong password", async () => {
    const u = await seedMember();
    const r = await loginMobile({ email: u.email, password: "wrong", secret: SECRET, prisma: testPrisma });
    expect(r.success).toBe(false);
  });

  it("rejects non-MEMBER role", async () => {
    const tenant = await testPrisma.tenant.create({
      data: { name: "T", slug: `t${Date.now()}${Math.random()}`, ownerEmail: "o@x.com", ownerPhone: "1", city: "Dakar", status: TenantStatus.ACTIVE },
    });
    const hash = await hashPassword("pass1234");
    const admin = await testPrisma.user.create({
      data: { name: "A", email: `a${Date.now()}@x.com`, passwordHash: hash, role: Role.TENANT_ADMIN, status: UserStatus.ACTIVE, tenantId: tenant.id },
    });
    const r = await loginMobile({ email: admin.email, password: "pass1234", secret: SECRET, prisma: testPrisma });
    expect(r.success).toBe(false);
  });
});

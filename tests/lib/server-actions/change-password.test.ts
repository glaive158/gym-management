import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { changePassword } from "@/lib/server-actions/change-password";
import { createMember } from "@/lib/server-actions/member-crud";
import { TenantStatus } from "@prisma/client";

afterAll(async () => { await testPrisma.$disconnect(); });

async function seedMember() {
  const t = await testPrisma.tenant.create({
    data: { name: "F", slug: "f", ownerEmail: "a@x.com", ownerPhone: "1", city: "x", status: TenantStatus.ACTIVE },
  });
  const c = await createMember({
    tenantId: t.id, name: "M", email: "m@x.com", phone: "+221770000000",
    avatar: "/uploads/a.jpg", password: "initial123", prisma: testPrisma,
  });
  return c.userId!;
}

describe("changePassword", () => {
  beforeEach(async () => { await resetDb(); });

  it("changes the password and clears mustChangePassword", async () => {
    const userId = await seedMember();
    const before = await testPrisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(before.mustChangePassword).toBe(true);

    const r = await changePassword({
      userId, currentPassword: "initial123", newPassword: "brandnew456", prisma: testPrisma,
    });
    expect(r.success).toBe(true);

    const after = await testPrisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(after.mustChangePassword).toBe(false);
    expect(after.passwordHash).not.toBe(before.passwordHash);
  });

  it("rejects a wrong current password", async () => {
    const userId = await seedMember();
    const r = await changePassword({
      userId, currentPassword: "wrongpass", newPassword: "brandnew456", prisma: testPrisma,
    });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/actuel/i);
  });

  it("rejects a new password shorter than 8 characters", async () => {
    const userId = await seedMember();
    const r = await changePassword({
      userId, currentPassword: "initial123", newPassword: "short", prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown user", async () => {
    const r = await changePassword({
      userId: "nonexistent", currentPassword: "x", newPassword: "brandnew456", prisma: testPrisma,
    });
    expect(r.success).toBe(false);
  });
});

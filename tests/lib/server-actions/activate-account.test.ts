import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { activateAccount } from "@/lib/server-actions/activate-account";
import { Role, UserStatus } from "@prisma/client";

async function seedPendingUserWithToken(token: string, expiresAt: Date) {
  return testPrisma.user.create({
    data: {
      name: "Aliou",
      email: "aliou@x.com",
      passwordHash: null,
      role: Role.TENANT_ADMIN,
      status: UserStatus.PENDING,
      activationToken: token,
      activationTokenExpiresAt: expiresAt,
    },
  });
}

describe("activateAccount", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("sets password, flips status to ACTIVE, clears token", async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await seedPendingUserWithToken("validtoken123", future);

    const result = await activateAccount({
      token: "validtoken123",
      password: "Hunter2Pass!",
      prisma: testPrisma,
    });
    expect(result.success).toBe(true);

    const updated = await testPrisma.user.findUniqueOrThrow({ where: { email: "aliou@x.com" } });
    expect(updated.status).toBe(UserStatus.ACTIVE);
    expect(updated.passwordHash).not.toBeNull();
    expect(updated.passwordHash).not.toBe("Hunter2Pass!");
    expect(updated.activationToken).toBeNull();
    expect(updated.activationTokenExpiresAt).toBeNull();
    expect(updated.passwordSetAt).not.toBeNull();
  });

  it("rejects unknown token", async () => {
    const result = await activateAccount({
      token: "doesnotexist",
      password: "Hunter2Pass!",
      prisma: testPrisma,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalide|expir/i);
  });

  it("rejects expired token", async () => {
    const past = new Date(Date.now() - 60_000);
    await seedPendingUserWithToken("expiredtoken", past);
    const result = await activateAccount({
      token: "expiredtoken",
      password: "Hunter2Pass!",
      prisma: testPrisma,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expir/i);
  });

  it("rejects password shorter than 8 chars", async () => {
    const future = new Date(Date.now() + 60_000);
    await seedPendingUserWithToken("token2", future);
    const result = await activateAccount({
      token: "token2",
      password: "short",
      prisma: testPrisma,
    });
    expect(result.success).toBe(false);
  });
});

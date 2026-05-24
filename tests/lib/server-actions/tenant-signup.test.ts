import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../../helpers/db";
import { createSignupRequest } from "@/lib/server-actions/tenant-signup";
import { Role, TenantStatus, UserStatus } from "@prisma/client";

describe("createSignupRequest", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  function input(overrides: Partial<Parameters<typeof createSignupRequest>[0]> = {}) {
    return {
      organizationName: "FitClub Dakar",
      ownerName: "Aliou Diop",
      ownerEmail: "aliou@fitclub.sn",
      ownerPhone: "+221771234567",
      city: "Dakar",
      prisma: testPrisma,
      ...overrides,
    };
  }

  it("creates a Tenant in PENDING status", async () => {
    const result = await createSignupRequest(input());
    expect(result.success).toBe(true);
    const tenants = await testPrisma.tenant.findMany();
    expect(tenants).toHaveLength(1);
    expect(tenants[0].status).toBe(TenantStatus.PENDING);
    expect(tenants[0].name).toBe("FitClub Dakar");
    expect(tenants[0].slug).toBe("fitclub-dakar");
  });

  it("creates a User TENANT_ADMIN in PENDING status with no password", async () => {
    await createSignupRequest(input());
    const users = await testPrisma.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe(Role.TENANT_ADMIN);
    expect(users[0].status).toBe(UserStatus.PENDING);
    expect(users[0].passwordHash).toBeNull();
    expect(users[0].email).toBe("aliou@fitclub.sn");
  });

  it("rejects duplicate email", async () => {
    await createSignupRequest(input());
    const result = await createSignupRequest(input({ organizationName: "Other Org" }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email.*déjà|already/i);
  });

  it("appends -2 when slug collides", async () => {
    await createSignupRequest(input());
    await createSignupRequest(input({ ownerEmail: "second@fitclub.sn" }));
    const tenants = await testPrisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
    expect(tenants[0].slug).toBe("fitclub-dakar");
    expect(tenants[1].slug).toBe("fitclub-dakar-2");
  });

  it("rejects invalid email", async () => {
    const result = await createSignupRequest(input({ ownerEmail: "not-an-email" }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it("rejects missing required fields", async () => {
    const result = await createSignupRequest(input({ organizationName: "" }));
    expect(result.success).toBe(false);
  });
});

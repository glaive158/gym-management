import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { testPrisma, resetDb } from "../helpers/db";
import { buildAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";

describe("buildAuthContext", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("returns null when session is null", () => {
    expect(buildAuthContext(null)).toBeNull();
  });

  it("builds context for PLATFORM_OWNER with null tenantId", () => {
    const ctx = buildAuthContext({
      user: { id: "u1", email: "po@x.com", name: "PO", role: Role.PLATFORM_OWNER, tenantId: null, gymId: null, mustChangePassword: false },
      expires: "2099-01-01",
    });
    expect(ctx).toEqual({
      userId: "u1",
      role: Role.PLATFORM_OWNER,
      tenantId: null,
      gymId: null,
    });
  });

  it("builds context for MANAGER with tenantId and gymId", () => {
    const ctx = buildAuthContext({
      user: { id: "u2", email: "m@x.com", name: "M", role: Role.MANAGER, tenantId: "t1", gymId: "g1", mustChangePassword: false },
      expires: "2099-01-01",
    });
    expect(ctx?.tenantId).toBe("t1");
    expect(ctx?.gymId).toBe("g1");
  });
});

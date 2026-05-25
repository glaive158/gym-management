import { describe, it, expect } from "vitest";
import { signMobileToken, verifyMobileToken } from "@/lib/jwt-mobile";

const SECRET = "test-secret-must-be-long-enough-for-hs256";

describe("mobile JWT", () => {
  it("signs and verifies a token", async () => {
    const token = await signMobileToken({ userId: "u1", role: "MEMBER", tenantId: "t1" }, SECRET);
    expect(token.split(".")).toHaveLength(3);
    const payload = await verifyMobileToken(token, SECRET);
    expect(payload.userId).toBe("u1");
    expect(payload.role).toBe("MEMBER");
    expect(payload.tenantId).toBe("t1");
  });

  it("rejects token signed with wrong secret", async () => {
    const token = await signMobileToken({ userId: "u1", role: "MEMBER", tenantId: "t1" }, SECRET);
    await expect(verifyMobileToken(token, "other-secret-long-enough-for-hs256")).rejects.toThrow();
  });

  it("rejects malformed token", async () => {
    await expect(verifyMobileToken("not-a-jwt", SECRET)).rejects.toThrow();
  });
});

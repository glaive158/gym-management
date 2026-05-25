import { verifyMobileToken, type MobileTokenPayload } from "@/lib/jwt-mobile";

export async function authMobileRequest(req: Request): Promise<MobileTokenPayload | null> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  try {
    const payload = await verifyMobileToken(token, secret);
    if (payload.role !== "MEMBER") return null;
    return payload;
  } catch {
    return null;
  }
}

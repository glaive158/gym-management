import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const EXPIRES_IN = "30d";

export interface MobileTokenPayload {
  userId: string;
  role: string;
  tenantId: string | null;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signMobileToken(payload: MobileTokenPayload, secret: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(key(secret));
}

export async function verifyMobileToken(token: string, secret: string): Promise<MobileTokenPayload> {
  const { payload } = await jwtVerify(token, key(secret), { algorithms: [ALG] });
  return {
    userId: payload.userId as string,
    role: payload.role as string,
    tenantId: (payload.tenantId as string | null) ?? null,
  };
}

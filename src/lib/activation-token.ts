import crypto from "node:crypto";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface ActivationToken {
  token: string;
  expiresAt: Date;
}

export function generateActivationToken(): ActivationToken {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  return { token, expiresAt };
}

export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= Date.now();
}

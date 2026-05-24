import { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";

export interface AuthContext {
  userId: string;
  role: Role;
  tenantId: string | null;
  gymId: string | null;
}

export function buildAuthContext(session: Session | null): AuthContext | null {
  if (!session?.user) return null;
  return {
    userId: session.user.id,
    role: session.user.role,
    tenantId: session.user.tenantId,
    gymId: session.user.gymId,
  };
}

export async function getCurrentAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);
  return buildAuthContext(session);
}

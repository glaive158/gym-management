import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { authMobileRequest } from "@/lib/mobile-auth-context";
import { listPrograms } from "@/lib/server-actions/fitness-program-crud";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getCurrentAuthContext();
  let userId = ctx?.userId;
  let tenantId = ctx?.tenantId ?? null;
  let gymId = ctx?.gymId ?? null;

  if (!userId) {
    const mobile = await authMobileRequest(req);
    if (!mobile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const u = await prisma.user.findUnique({
      where: { id: mobile.userId },
      select: { id: true, tenantId: true, gymId: true },
    });
    if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = u.id;
    tenantId = u.tenantId;
    gymId = u.gymId;
  }

  if (!tenantId || !gymId) return NextResponse.json({ error: "No gym" }, { status: 400 });

  const r = await listPrograms({ tenantId, gymId, memberId: userId, prisma });
  return NextResponse.json(r.data);
}

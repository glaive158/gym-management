import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMobileRequest } from "@/lib/mobile-auth-context";

export async function GET(req: Request) {
  const auth = await authMobileRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const checks = await prisma.checkIn.findMany({
    where: { memberId: auth.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { gym: { select: { id: true, name: true } } },
  });
  return NextResponse.json(checks);
}

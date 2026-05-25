import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMobileRequest } from "@/lib/mobile-auth-context";

export async function GET(req: Request) {
  const auth = await authMobileRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subs = await prisma.subscription.findMany({
    where: { memberId: auth.userId },
    orderBy: { endDate: "desc" },
    include: { plan: true },
  });
  return NextResponse.json(subs);
}

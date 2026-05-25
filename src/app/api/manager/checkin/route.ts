import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { manualCheckIn } from "@/lib/server-actions/checkin";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.gymId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const result = await manualCheckIn({ gymId: ctx.gymId, memberId: String(body.memberId ?? ""), prisma });
  return NextResponse.json(result);
}

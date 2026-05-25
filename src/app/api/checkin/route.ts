import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { performCheckIn } from "@/lib/server-actions/checkin";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MEMBER) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const lat = Number(body.latitude), lng = Number(body.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return NextResponse.json({ error: "BAD_GEO" }, { status: 400 });
  const result = await performCheckIn({
    memberId: ctx.userId,
    qrToken: String(body.qrToken ?? ""),
    latitude: lat,
    longitude: lng,
    prisma,
  });
  return NextResponse.json(result);
}

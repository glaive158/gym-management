import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendExpirationNotifications } from "@/lib/server-actions/notifications";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const r = await sendExpirationNotifications({ prisma });
  return NextResponse.json({ ok: true, ...r });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkOverdueInvoices } from "@/lib/server-actions/billing";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const r = await checkOverdueInvoices({ prisma });
  return NextResponse.json({ ok: true, ...r });
}

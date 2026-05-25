import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateMonthlyInvoices } from "@/lib/server-actions/billing";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const r = await generateMonthlyInvoices({ periodStart, prisma });
  return NextResponse.json({ ok: true, ...r });
}

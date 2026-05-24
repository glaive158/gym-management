import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSignupRequest } from "@/lib/server-actions/tenant-signup";

export async function POST(req: Request) {
  const body = await req.json();
  const result = await createSignupRequest({
    organizationName: body.organizationName,
    ownerName: body.ownerName,
    ownerEmail: body.ownerEmail,
    ownerPhone: body.ownerPhone,
    city: body.city,
    prisma,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, tenantId: result.tenantId });
}

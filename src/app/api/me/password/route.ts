import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authMobileRequest } from "@/lib/mobile-auth-context";
import { changePassword } from "@/lib/server-actions/change-password";

// Resolve the current user id from either a NextAuth web session or a
// mobile Bearer token, so members can change their password on both surfaces.
async function resolveUserId(req: Request): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;
  const mobile = await authMobileRequest(req);
  if (mobile?.userId) return mobile.userId;
  return null;
}

export async function POST(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const r = await changePassword({
    userId,
    currentPassword: String(body.currentPassword ?? ""),
    newPassword: String(body.newPassword ?? ""),
    prisma,
  });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}

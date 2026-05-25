import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authMobileRequest } from "@/lib/mobile-auth-context";

export async function GET(req: Request) {
  const auth = await authMobileRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true, name: true, email: true, phone: true, avatar: true,
      gym: { select: { id: true, name: true, address: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { pusherAuthorize } from "@/lib/pusher-server";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.gymId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const form = await req.formData();
  const socketId = String(form.get("socket_id") ?? "");
  const channel = String(form.get("channel_name") ?? "");
  if (channel !== `private-gym-${ctx.gymId}`) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const auth = pusherAuthorize(channel, socketId);
  if (!auth) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  return NextResponse.json(auth);
}

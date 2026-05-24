import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { saveAvatar } from "@/lib/upload";

export async function POST(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const r = await saveAvatar(buffer);
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, url: r.url });
}

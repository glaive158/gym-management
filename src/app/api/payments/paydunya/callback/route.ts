import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paydunyaConfigFromEnv } from "@/lib/paydunya";
import { confirmPayment } from "@/lib/server-actions/paydunya-payments";

// PayDunya IPN webhook. We never trust the payload directly: we extract the
// invoice token and re-verify the real status through the PayDunya confirm API.
export async function POST(req: Request) {
  const config = paydunyaConfigFromEnv();
  if (!config) return NextResponse.json({ error: "PayDunya non configuré" }, { status: 503 });

  const contentType = req.headers.get("content-type") ?? "";
  let token: string | undefined;

  try {
    if (contentType.includes("application/json")) {
      const j = await req.json().catch(() => ({}));
      token = j?.data?.invoice?.token ?? j?.invoice?.token ?? j?.token;
    } else {
      const form = await req.formData();
      for (const [key, value] of Array.from(form.entries())) {
        if (key.endsWith("[invoice][token]") || key === "token") {
          token = String(value);
          break;
        }
      }
    }
  } catch {
    token = undefined;
  }

  if (!token) return NextResponse.json({ error: "Token manquant" }, { status: 400 });

  const r = await confirmPayment({ token, config, prisma });
  if (!r.success) return NextResponse.json({ error: r.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}

import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { CheckinClient } from "./checkin-client";

export const dynamic = "force-dynamic";

export default async function CheckinPage({ searchParams }: { searchParams: { gym?: string } }) {
  const qr = searchParams.gym ?? "";
  if (!qr) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="max-w-md mx-auto mt-12 text-center">QR manquant.</div>
      </main>
    );
  }
  const ctx = await getCurrentAuthContext();
  if (!ctx) redirect(`/login?callbackUrl=${encodeURIComponent(`/checkin?gym=${qr}`)}`);
  if (ctx.role !== Role.MEMBER) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="max-w-md mx-auto mt-12 text-center">Cette page est réservée aux membres.</div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <CheckinClient qrToken={qr} />
    </main>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const gymCount = await prisma.gym.count({ where: { tenantId: ctx.tenantId } });
  if (gymCount === 0) {
    redirect("/admin/onboarding");
  }

  const gyms = await prisma.gym.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard organisation</h1>
      <div>
        <h2 className="text-lg font-semibold mb-3">Vos salles ({gyms.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gyms.map((g) => (
            <div key={g.id} className="bg-slate-900 border border-slate-800 rounded p-4">
              <div className="font-medium text-slate-100">{g.name}</div>
              <div className="text-sm text-slate-400">{g.address} — {g.city}</div>
              <div className="text-xs text-slate-500 mt-2 font-mono">QR token: {g.qrToken.slice(0, 12)}…</div>
            </div>
          ))}
        </div>
        <Link href="/admin/onboarding" className="inline-block mt-4 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">
          + Ajouter une salle
        </Link>
      </div>
    </div>
  );
}

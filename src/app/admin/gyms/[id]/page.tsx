import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { GymDeleteButton } from "@/components/admin/gym-delete-button";

export const dynamic = "force-dynamic";

export default async function GymDetail({ params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const scoped = tenantPrisma(prisma, ctx.tenantId);
  const gym = await scoped.gym.findUnique({
    where: { id: params.id },
    include: {
      users: { where: { role: "MANAGER" } },
      plans: { where: { isActive: true }, orderBy: { durationDays: "asc" } },
    },
  });
  if (!gym) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/gyms" className="text-sm text-slate-400 hover:text-slate-200">← Salles</Link>
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">{gym.name}</h1>
        <div className="flex items-center gap-3">
          <Link href={`/admin/gyms/${gym.id}/edit`}
            className="px-3 py-2 rounded border border-slate-700 hover:bg-slate-900 text-sm">Modifier</Link>
          <GymDeleteButton gym={{ id: gym.id, name: gym.name }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase mb-2">Coordonnées</div>
          <div className="text-sm text-slate-300">{gym.address}</div>
          <div className="text-sm text-slate-400">{gym.city} · {gym.phone}</div>
          <div className="text-xs text-slate-500 mt-2 font-mono">
            {gym.latitude.toFixed(4)}, {gym.longitude.toFixed(4)}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase mb-2">QR Code (URL de check-in)</div>
          <div className="text-xs text-slate-300 font-mono break-all">
            /checkin?gym={gym.qrToken}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Gérants ({gym.users.length})</h2>
        {gym.users.length === 0
          ? <p className="text-sm text-slate-500">Aucun gérant assigné.</p>
          : <ul className="space-y-1">{gym.users.map(m => (
              <li key={m.id} className="text-sm text-slate-300">{m.name} — {m.email}</li>
            ))}</ul>}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Formules ({gym.plans.length})</h2>
        {gym.plans.length === 0
          ? <p className="text-sm text-slate-500">Aucune formule. Le manager peut en créer.</p>
          : <ul className="space-y-1">{gym.plans.map(p => (
              <li key={p.id} className="text-sm text-slate-300">
                {p.name} — {p.durationDays}j — {p.price.toLocaleString("fr-FR")} {p.currency}
              </li>
            ))}</ul>}
      </div>
    </div>
  );
}

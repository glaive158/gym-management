import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listGyms } from "@/lib/server-actions/gym-crud";

export const dynamic = "force-dynamic";

export default async function GymsList() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const [gyms, tenant] = await Promise.all([
    listGyms({ tenantId: ctx.tenantId, prisma }),
    prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { gymQuota: true } }),
  ]);
  const quota = tenant?.gymQuota ?? 1;
  const atLimit = gyms.length >= quota;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">Salles ({gyms.length} / {quota})</h1>
          {atLimit && (
            <p className="text-xs text-amber-400 mt-1">
              Quota atteint. <Link href="/admin/upgrade" className="underline">Augmenter mon quota</Link>
            </p>
          )}
        </div>
        {atLimit ? (
          <Link href="/admin/upgrade"
            className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-sm font-medium">Augmenter le quota</Link>
        ) : (
          <Link href="/admin/gyms/new"
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">+ Ajouter</Link>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gyms.length === 0 && (
          <p className="text-slate-500 text-sm">Aucune salle. <Link className="text-blue-400" href="/admin/gyms/new">Ajouter la première</Link>.</p>
        )}
        {gyms.map((g) => (
          <Link key={g.id} href={`/admin/gyms/${g.id}`}
            className="bg-slate-900 border border-slate-800 rounded p-4 hover:border-slate-600">
            <div className="font-medium text-slate-100">{g.name}</div>
            <div className="text-sm text-slate-400">{g.address} — {g.city}</div>
            <div className="text-xs text-slate-500 mt-2 font-mono">QR: {g.qrToken.slice(0, 12)}…</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

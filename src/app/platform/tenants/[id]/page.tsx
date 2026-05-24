import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TenantStatusBadge } from "@/components/platform/tenant-status-badge";
import { TenantActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function TenantDetail({ params }: { params: { id: string } }) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: {
      users: { where: { role: "TENANT_ADMIN" }, take: 1 },
      gyms: true,
    },
  });
  if (!tenant) notFound();

  const owner = tenant.users[0];

  return (
    <div className="space-y-6">
      <Link href="/platform/tenants" className="text-sm text-slate-400 hover:text-slate-200">← Tenants</Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          <p className="text-sm text-slate-400 mt-1">Slug : <span className="font-mono">{tenant.slug}</span></p>
        </div>
        <TenantStatusBadge status={tenant.status} />
      </div>

      {tenant.rejectionReason && (
        <div className="text-sm bg-red-950/30 border border-red-900 rounded p-3 text-red-300">
          Refusé : {tenant.rejectionReason}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase mb-2">Propriétaire</div>
          <div className="text-slate-100">{owner?.name ?? "—"}</div>
          <div className="text-sm text-slate-400">{tenant.ownerEmail}</div>
          <div className="text-sm text-slate-400">{tenant.ownerPhone}</div>
          <div className="text-sm text-slate-400 mt-2">Ville : {tenant.city}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase mb-2">Plan</div>
          <div className="text-slate-100">{tenant.monthlyPricePerGym.toLocaleString("fr-FR")} F / salle / mois</div>
          <div className="text-sm text-slate-400">Salles : {tenant.gyms.length}</div>
          {tenant.trialEndsAt && (
            <div className="text-sm text-slate-400 mt-2">
              Essai jusqu&apos;au {tenant.trialEndsAt.toLocaleDateString("fr-FR")}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Actions</h2>
        <TenantActions id={tenant.id} status={tenant.status} />
      </div>
    </div>
  );
}

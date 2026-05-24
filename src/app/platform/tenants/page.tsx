import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TenantStatusBadge } from "@/components/platform/tenant-status-badge";
import { TenantStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function TenantsList({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = (searchParams.status as TenantStatus | undefined) ?? undefined;
  const tenants = await prisma.tenant.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: "desc" },
  });

  const filters: Array<{ label: string; value?: TenantStatus }> = [
    { label: "Tous" },
    { label: "En attente", value: TenantStatus.PENDING },
    { label: "Actifs", value: TenantStatus.ACTIVE },
    { label: "Suspendus", value: TenantStatus.SUSPENDED },
    { label: "Refusés", value: TenantStatus.REJECTED },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tenants</h1>

      <div className="flex gap-2 text-sm">
        {filters.map((f) => {
          const href = f.value ? `/platform/tenants?status=${f.value}` : "/platform/tenants";
          const active = statusFilter === f.value || (!statusFilter && !f.value);
          return (
            <Link
              key={f.label}
              href={href}
              className={`px-3 py-1 rounded border ${
                active ? "border-blue-600 text-blue-300" : "border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Organisation</th>
              <th className="px-4 py-3 text-left">Propriétaire</th>
              <th className="px-4 py-3 text-left">Ville</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Créé</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Aucun tenant</td></tr>
            )}
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-100">{t.name}</td>
                <td className="px-4 py-3 text-slate-300">{t.ownerEmail}</td>
                <td className="px-4 py-3 text-slate-400">{t.city}</td>
                <td className="px-4 py-3"><TenantStatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-slate-400">{t.createdAt.toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/platform/tenants/${t.id}`} className="text-blue-400 hover:text-blue-300">
                    Voir →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

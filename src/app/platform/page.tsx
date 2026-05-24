import { prisma } from "@/lib/prisma";
import { TenantStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function PlatformDashboard() {
  const [total, pending, active, suspended, rejected] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: TenantStatus.PENDING } }),
    prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
    prisma.tenant.count({ where: { status: TenantStatus.SUSPENDED } }),
    prisma.tenant.count({ where: { status: TenantStatus.REJECTED } }),
  ]);

  const stats = [
    { label: "Total tenants", value: total, color: "text-slate-100" },
    { label: "En attente", value: pending, color: "text-amber-400" },
    { label: "Actifs", value: active, color: "text-green-400" },
    { label: "Suspendus", value: suspended, color: "text-orange-400" },
    { label: "Refusés", value: rejected, color: "text-red-400" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard plateforme</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-400 uppercase">{s.label}</div>
            <div className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

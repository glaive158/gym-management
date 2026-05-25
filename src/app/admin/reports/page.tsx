import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTenantReport } from "@/lib/server-actions/reports";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({ searchParams }: { searchParams: { year?: string; month?: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) redirect("/login");

  const now = new Date();
  const year = Number(searchParams.year ?? now.getFullYear());
  const month = Number(searchParams.month ?? now.getMonth() + 1);

  const report = await getTenantReport({ tenantId: ctx.tenantId, year, month, prisma });
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rapports organisation — {monthName}</h1>
        <a href={`/api/admin/reports/by-gym.csv?year=${year}&month=${month}`} className="px-3 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700">⬇ CSV par salle</a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs uppercase text-slate-400">Revenus</div>
          <div className="text-2xl font-bold mt-1 text-green-400">{report.revenueXof.toLocaleString("fr-FR")} XOF</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs uppercase text-slate-400">Paiements</div>
          <div className="text-2xl font-bold mt-1 text-slate-100">{report.paymentsCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs uppercase text-slate-400">Présences</div>
          <div className="text-2xl font-bold mt-1 text-cyan-400">{report.checkInsCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs uppercase text-slate-400">Membres</div>
          <div className="text-2xl font-bold mt-1 text-blue-400">{report.membersCount}</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Salle</th>
              <th className="px-4 py-3 text-right">Revenus</th>
              <th className="px-4 py-3 text-right">Paiements</th>
              <th className="px-4 py-3 text-right">Présences</th>
              <th className="px-4 py-3 text-right">Membres</th>
            </tr>
          </thead>
          <tbody>
            {report.byGym.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Aucune salle
                </td>
              </tr>
            )}
            {report.byGym.map((g) => (
              <tr key={g.gymId} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-100">{g.gymName}</td>
                <td className="px-4 py-3 text-right text-green-400">{g.revenueXof.toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3 text-right text-slate-300">{g.paymentsCount}</td>
                <td className="px-4 py-3 text-right text-cyan-400">{g.checkInsCount}</td>
                <td className="px-4 py-3 text-right text-blue-400">{g.membersCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

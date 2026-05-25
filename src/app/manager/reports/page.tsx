import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getManagerReport } from "@/lib/server-actions/reports";

export const dynamic = "force-dynamic";

export default async function ManagerReportsPage({ searchParams }: { searchParams: { year?: string; month?: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.gymId || !ctx.tenantId) redirect("/login");

  const now = new Date();
  const year = Number(searchParams.year ?? now.getFullYear());
  const month = Number(searchParams.month ?? now.getMonth() + 1);

  const report = await getManagerReport({ tenantId: ctx.tenantId, gymId: ctx.gymId, year, month, prisma });
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rapports — {monthName}</h1>
        <div className="flex gap-2">
          <a href="/api/manager/reports/payments.csv" className="px-3 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700">⬇ Paiements CSV</a>
          <a href="/api/manager/reports/checkins.csv" className="px-3 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700">⬇ Check-ins CSV</a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Revenus" value={`${report.revenueXof.toLocaleString("fr-FR")} XOF`} color="text-green-400" />
        <Stat label="Paiements" value={report.paymentsCount} color="text-slate-100" />
        <Stat label="Présences" value={report.checkInsCount} color="text-cyan-400" />
        <Stat label="Abonnements actifs" value={report.activeSubscriptions} color="text-blue-400" />
        <Stat label="Nouveaux membres" value={report.newMembers} color="text-amber-400" />
      </div>

      <MonthPicker year={year} month={month} basePath="/manager/reports" />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded p-4">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function MonthPicker({ year, month, basePath }: { year: number; month: number; basePath: string }) {
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return (
    <div className="flex items-center gap-3 text-sm text-slate-400">
      <a href={`${basePath}?year=${prev.y}&month=${prev.m}`} className="hover:text-slate-200">← Mois précédent</a>
      <span>·</span>
      <a href={basePath} className="hover:text-slate-200">Aujourd&apos;hui</a>
      <span>·</span>
      <a href={`${basePath}?year=${next.y}&month=${next.m}`} className="hover:text-slate-200">Mois suivant →</a>
    </div>
  );
}

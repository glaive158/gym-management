import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listPlans } from "@/lib/server-actions/plan-crud";

export const dynamic = "force-dynamic";

export default async function PlansList() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId) redirect("/login");

  const plans = await listPlans({ tenantId: ctx.tenantId, gymId: ctx.gymId, prisma, includeInactive: true });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Formules ({plans.length})</h1>
        <Link href="/manager/plans/new"
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">+ Ajouter</Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Formule</th>
              <th className="px-4 py-3 text-left">Durée</th>
              <th className="px-4 py-3 text-left">Prix</th>
              <th className="px-4 py-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Aucune formule</td></tr>
            )}
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 text-slate-100">{p.name}</td>
                <td className="px-4 py-3 text-slate-400">{p.durationDays} jours</td>
                <td className="px-4 py-3 text-slate-300">{p.price.toLocaleString("fr-FR")} {p.currency}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded border ${
                    p.isActive ? "bg-green-950 text-green-300 border-green-900" : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}>{p.isActive ? "Active" : "Désactivée"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

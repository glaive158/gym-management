import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { getMonthlyPaymentTotal } from "@/lib/server-actions/payment-crud";
import { SubscriptionStatus, Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ManagerDashboard() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId) redirect("/login");

  const scoped = tenantPrisma(prisma, ctx.tenantId);
  const gym = await scoped.gym.findUnique({ where: { id: ctx.gymId } });
  if (!gym) redirect("/login");

  const now = new Date();
  const [memberCount, activeSubs, plans, monthlyTotal] = await Promise.all([
    scoped.user.count({ where: { role: Role.MEMBER } }),
    scoped.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    scoped.plan.count({ where: { gymId: ctx.gymId, isActive: true } }),
    getMonthlyPaymentTotal({
      tenantId: ctx.tenantId,
      gymId: ctx.gymId,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      prisma,
    }),
  ]);

  const monthName = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{gym.name}</h1>
        <p className="text-sm text-slate-400">{gym.address}, {gym.city}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase">Membres</div>
          <div className="text-3xl font-bold text-slate-100 mt-1">{memberCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase">Abonnements actifs</div>
          <div className="text-3xl font-bold text-green-400 mt-1">{activeSubs}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase">Formules disponibles</div>
          <div className="text-3xl font-bold text-blue-400 mt-1">{plans}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase truncate">Encaissé {monthName}</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">
            {monthlyTotal.total.toLocaleString("fr-FR")}
            <span className="text-sm font-normal text-slate-400 ml-1">XOF</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{monthlyTotal.count} paiement{monthlyTotal.count > 1 ? "s" : ""}</div>
        </div>
      </div>
      <div className="text-sm text-slate-400">
        Le dashboard temps réel des check-ins arrive dans le plan suivant.
      </div>
    </div>
  );
}

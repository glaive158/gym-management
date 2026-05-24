import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { listPlans } from "@/lib/server-actions/plan-crud";
import { SubscriptionAssign } from "@/components/manager/subscription-assign";

export const dynamic = "force-dynamic";

export default async function MemberDetail({ params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId) redirect("/login");

  const scoped = tenantPrisma(prisma, ctx.tenantId);
  const member = await scoped.user.findUnique({
    where: { id: params.id },
    include: {
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!member || member.role !== "MEMBER") notFound();

  const plans = await listPlans({ tenantId: ctx.tenantId, gymId: ctx.gymId, prisma });

  return (
    <div className="space-y-6">
      <Link href="/manager/members" className="text-sm text-slate-400 hover:text-slate-200">← Membres</Link>
      <div className="flex items-start gap-4">
        {member.avatar
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={member.avatar} alt={member.name} className="w-24 h-24 object-cover rounded" />
          : <div className="w-24 h-24 bg-slate-800 rounded" />}
        <div>
          <h1 className="text-2xl font-semibold">{member.name}</h1>
          <p className="text-sm text-slate-400">{member.email} · {member.phone}</p>
          <p className="text-xs text-slate-500 mt-1">Statut : {member.status}</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Abonnements</h2>
        {member.subscriptions.length === 0
          ? <p className="text-sm text-slate-500">Aucun abonnement.</p>
          : (
            <table className="w-full text-sm bg-slate-900 border border-slate-800 rounded overflow-hidden">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2 text-left">Formule</th>
                  <th className="px-4 py-2 text-left">Du</th>
                  <th className="px-4 py-2 text-left">Au</th>
                  <th className="px-4 py-2 text-left">Statut</th>
                </tr>
              </thead>
              <tbody>
                {member.subscriptions.map(s => (
                  <tr key={s.id} className="border-b border-slate-800 last:border-0">
                    <td className="px-4 py-2 text-slate-200">{s.plan.name}</td>
                    <td className="px-4 py-2 text-slate-400">{s.startDate.toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-2 text-slate-400">{s.endDate.toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-2 text-slate-300">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Attribuer un nouvel abonnement</h2>
        <SubscriptionAssign
          memberId={member.id}
          plans={plans.map(p => ({
            id: p.id, name: p.name, durationDays: p.durationDays,
            price: p.price, currency: p.currency,
          }))}
        />
      </div>
    </div>
  );
}

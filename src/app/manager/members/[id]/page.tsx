import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { listPlans } from "@/lib/server-actions/plan-crud";
import { listPayments } from "@/lib/server-actions/payment-crud";
import { SubscriptionAssign } from "@/components/manager/subscription-assign";
import { PaymentForm } from "@/components/manager/payment-form";
import { MemberEditForm } from "@/components/manager/member-edit-form";
import { SubscriptionCancel } from "@/components/manager/subscription-cancel";
import { SubscriptionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  PAYDUNYA: "PayDunya",
  CASH: "Espèces",
  TPE: "TPE",
};

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

  const [plans, payments] = await Promise.all([
    listPlans({ tenantId: ctx.tenantId, gymId: ctx.gymId, prisma }),
    listPayments({ tenantId: ctx.tenantId, memberId: member.id, prisma }),
  ]);

  const activeSubscriptions = member.subscriptions
    .filter((s) => s.status === SubscriptionStatus.ACTIVE)
    .map((s) => ({
      id: s.id,
      planName: s.plan.name,
      endDate: s.endDate.toISOString(),
      amount: s.plan.price,
      currency: s.plan.currency,
    }));

  return (
    <div className="space-y-8">
      <Link href="/manager/members" className="text-sm text-slate-400 hover:text-slate-200">
        ← Membres
      </Link>

      <div className="flex items-start gap-4">
        {member.avatar
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={member.avatar} alt={member.name} className="w-24 h-24 object-cover rounded" />
          : <div className="w-24 h-24 bg-slate-800 rounded" />}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{member.name}</h1>
          <p className="text-sm text-slate-400">{member.email} · {member.phone}</p>
          <p className="text-xs text-slate-500">Statut : {member.status}</p>
          <MemberEditForm member={{ id: member.id, name: member.name, phone: member.phone }} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Abonnements</h2>
        {member.subscriptions.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun abonnement.</p>
        ) : (
          <table className="w-full text-sm bg-slate-900 border border-slate-800 rounded overflow-hidden">
            <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2 text-left">Formule</th>
                <th className="px-4 py-2 text-left">Du</th>
                <th className="px-4 py-2 text-left">Au</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {member.subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-slate-800 last:border-0">
                  <td className="px-4 py-2 text-slate-200">{s.plan.name}</td>
                  <td className="px-4 py-2 text-slate-400">{s.startDate.toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2 text-slate-400">{s.endDate.toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2 text-slate-300">{s.status}</td>
                  <td className="px-4 py-2 text-right">
                    {s.status === SubscriptionStatus.ACTIVE && <SubscriptionCancel subscriptionId={s.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Attribuer un abonnement</h2>
        <SubscriptionAssign
          memberId={member.id}
          plans={plans.map((p) => ({
            id: p.id, name: p.name, durationDays: p.durationDays,
            price: p.price, currency: p.currency,
          }))}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Enregistrer un paiement</h2>
        <PaymentForm memberId={member.id} subscriptions={activeSubscriptions} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Historique paiements ({payments.length})</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun paiement enregistré.</p>
        ) : (
          <table className="w-full text-sm bg-slate-900 border border-slate-800 rounded overflow-hidden">
            <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Méthode</th>
                <th className="px-4 py-2 text-left">Référence</th>
                <th className="px-4 py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-800 last:border-0">
                  <td className="px-4 py-2 text-slate-400">
                    {new Date(p.paidAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">
                      {METHOD_LABELS[p.method] ?? p.method}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-400 font-mono text-xs">
                    {p.reference ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-100">
                    {p.amount.toLocaleString("fr-FR")} {p.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

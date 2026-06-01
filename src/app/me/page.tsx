import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus } from "@prisma/client";
import { SignOutButton } from "@/components/platform/sign-out-button";
import { PayOnline } from "@/components/member/pay-online";

export const dynamic = "force-dynamic";

const CHECKIN_LABELS: Record<string, string> = {
  VALID: "Validé",
  EXPIRED: "Expiré",
  GEO_REJECTED: "Hors zone",
  DUPLICATE: "Doublon",
  NO_SUBSCRIPTION: "Sans abonnement",
};

export default async function MemberSpace({ searchParams }: { searchParams: { payment?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "MEMBER") redirect("/login");

  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
      checkIns: { orderBy: { createdAt: "desc" }, take: 20, include: { gym: { select: { name: true } } } },
    },
  });
  if (!member) redirect("/login");

  const active = member.subscriptions.find((s) => s.status === SubscriptionStatus.ACTIVE);
  const plans = member.tenantId
    ? await prisma.plan.findMany({
        where: { tenantId: member.tenantId, isActive: true },
        orderBy: { durationDays: "asc" },
      })
    : [];
  const paymentStatus = searchParams.payment;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold">Mon espace</span>
        <div className="flex items-center gap-4">
          <Link href="/account/password" className="text-sm text-slate-400 hover:text-slate-200">Mot de passe</Link>
          <SignOutButton />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Profil */}
        <section className="flex items-center gap-4">
          {member.avatar
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={member.avatar} alt={member.name} className="w-20 h-20 rounded-full object-cover" />
            : <div className="w-20 h-20 rounded-full bg-slate-800" />}
          <div>
            <h1 className="text-xl font-semibold">{member.name}</h1>
            <p className="text-sm text-slate-400">{member.email ?? "sans email"}</p>
            <p className="text-sm text-slate-400">{member.phone}</p>
          </div>
        </section>

        {paymentStatus === "success" && (
          <div className="bg-green-950/40 border border-green-900 rounded p-3 text-green-300 text-sm">
            Paiement reçu. Votre abonnement est en cours d&apos;activation.
          </div>
        )}
        {paymentStatus === "cancel" && (
          <div className="bg-red-950/40 border border-red-900 rounded p-3 text-red-300 text-sm">
            Paiement annulé.
          </div>
        )}

        {member.mustChangePassword && (
          <div className="bg-amber-950/40 border border-amber-900 rounded p-3 text-amber-300 text-sm">
            Pensez à changer votre mot de passe. <Link href="/account/password" className="underline">Changer maintenant</Link>
          </div>
        )}

        {/* Abonnement */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Abonnement</h2>
          {active ? (
            <div className="bg-green-950/40 border border-green-900 rounded p-4">
              <div className="font-medium text-green-200">{active.plan.name}</div>
              <div className="text-sm text-green-300/80">
                Valable jusqu&apos;au {active.endDate.toLocaleDateString("fr-FR")}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                {active.plan.price.toLocaleString("fr-FR")} {active.plan.currency}
              </div>
            </div>
          ) : (
            <div className="bg-red-950/40 border border-red-900 rounded p-4 text-red-300 text-sm">
              Aucun abonnement actif. Contactez votre salle.
            </div>
          )}
        </section>

        {/* Fitness */}
        <section>
          <Link href="/me/fitness"
            className="block bg-slate-900 border border-slate-800 hover:border-lime-500 rounded-lg p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">💪 Mon suivi fitness</h2>
                <p className="text-sm text-slate-400">Programme, séances, poids et progression</p>
              </div>
              <span className="text-slate-500">→</span>
            </div>
          </Link>
        </section>

        {/* Paiement en ligne */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Payer / Renouveler en ligne</h2>
          <PayOnline plans={plans.map((p) => ({ id: p.id, name: p.name, price: p.price, currency: p.currency, durationDays: p.durationDays }))} />
        </section>

        {/* Historique check-ins */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Derniers check-ins</h2>
          {member.checkIns.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun check-in.</p>
          ) : (
            <ul className="divide-y divide-slate-800 bg-slate-900 border border-slate-800 rounded">
              {member.checkIns.map((c) => (
                <li key={c.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="text-slate-200">{c.gym.name}</div>
                    <div className="text-slate-500 text-xs">
                      {new Date(c.createdAt).toLocaleString("fr-FR")}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border ${
                    c.status === "VALID"
                      ? "bg-green-950 text-green-300 border-green-900"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}>{CHECKIN_LABELS[c.status] ?? c.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

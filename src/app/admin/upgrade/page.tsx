import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";

export const dynamic = "force-dynamic";

export default async function UpgradePage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const [tenant, gymCount] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true, gymQuota: true } }),
    tenantPrisma(prisma, ctx.tenantId).gym.count(),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/gyms" className="text-sm text-slate-400 hover:text-slate-200">← Salles</Link>
      <h1 className="text-2xl font-semibold">Augmenter votre quota de salles</h1>

      <div className="bg-amber-950/30 border border-amber-900 rounded p-4 text-amber-200 text-sm space-y-1">
        <div>Organisation : <strong>{tenant?.name}</strong></div>
        <div>Quota actuel : <strong>{tenant?.gymQuota ?? 1}</strong> salle(s)</div>
        <div>Salles utilisées : <strong>{gymCount}</strong></div>
      </div>

      <div className="space-y-3 text-slate-300 text-sm">
        <p>
          Votre forfait actuel couvre <strong>{tenant?.gymQuota ?? 1}</strong> salle(s). Pour
          ajouter une salle supplémentaire, contactez le support Kaytech afin de mettre à jour
          votre quota.
        </p>
        <p>
          Tarif indicatif : <strong>25 000 FCFA / mois / salle additionnelle</strong>.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-2">
        <div className="text-xs uppercase text-slate-400">Contact support</div>
        <div className="text-slate-200">📧 <a href="mailto:contact@kaytech.sn" className="text-blue-400 hover:underline">contact@kaytech.sn</a></div>
        <div className="text-slate-200">📞 +221 77 ___ __ __</div>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listPayments } from "@/lib/server-actions/payment-crud";

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  PAYDUNYA: "PayDunya",
  CASH: "Espèces",
  TPE: "TPE",
};

export default async function PaymentsPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId) redirect("/login");

  const payments = await listPayments({
    tenantId: ctx.tenantId,
    gymId: ctx.gymId,
    prisma,
  });

  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Paiements ({payments.length})</h1>
        <div className="text-right">
          <div className="text-xs text-slate-400 uppercase">Total encaissé</div>
          <div className="text-xl font-bold text-green-400">
            {total.toLocaleString("fr-FR")} XOF
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Membre</th>
              <th className="px-4 py-3 text-left">Méthode</th>
              <th className="px-4 py-3 text-left">Référence</th>
              <th className="px-4 py-3 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Aucun paiement enregistré.
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 text-slate-400">
                  {new Date(p.paidAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-slate-100">{p.memberName}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">
                    {METHOD_LABELS[p.method] ?? p.method}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                  {p.reference ?? "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-100">
                  {p.amount.toLocaleString("fr-FR")} {p.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

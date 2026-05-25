import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { InvoiceStatusBadge } from "@/components/platform/invoice-status-badge";

export const dynamic = "force-dynamic";

const BILLING_LABEL: Record<string, string> = {
  TRIAL: "Essai gratuit",
  ACTIVE: "Actif",
  OVERDUE: "En retard",
  SUSPENDED: "Suspendu",
};

export default async function BillingPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
  const invoices = await prisma.tenantInvoice.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { periodStart: "desc" },
  });
  const totalPaid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.totalXof, 0);
  const totalDue = invoices
    .filter((i) => i.status === "PENDING" || i.status === "OVERDUE")
    .reduce((s, i) => s + i.totalXof, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Facturation</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs uppercase text-slate-400">Statut</div>
          <div className="text-xl font-bold mt-1 text-slate-100">{BILLING_LABEL[tenant.billingStatus]}</div>
          {tenant.trialEndsAt && tenant.trialEndsAt > new Date() && (
            <div className="text-xs text-amber-400 mt-1">
              Essai jusqu&apos;au {tenant.trialEndsAt.toLocaleDateString("fr-FR")}
            </div>
          )}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs uppercase text-slate-400">Encaissé</div>
          <div className="text-xl font-bold mt-1 text-green-400">
            {totalPaid.toLocaleString("fr-FR")} XOF
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs uppercase text-slate-400">À payer</div>
          <div className="text-xl font-bold mt-1 text-amber-400">
            {totalDue.toLocaleString("fr-FR")} XOF
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Période</th>
              <th className="px-4 py-3 text-right">Salles</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Échéance</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Aucune facture (essai en cours)
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 text-slate-100">
                  {inv.periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                </td>
                <td className="px-4 py-3 text-right text-slate-300">{inv.nbGyms}</td>
                <td className="px-4 py-3 text-right text-slate-100">{inv.totalXof.toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3 text-slate-400">{inv.dueDate.toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={inv.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`/api/admin/invoices/${inv.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    📄 PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalDue > 0 && (
        <div className="bg-amber-950 border border-amber-900 rounded p-4 text-sm text-amber-200">
          Pour payer une facture en attente, contactez la plateforme par Wave, Orange Money, PayDunya ou virement
          bancaire. Le règlement sera confirmé sous 24h.
        </div>
      )}
    </div>
  );
}

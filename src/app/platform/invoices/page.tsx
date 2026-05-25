import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { InvoiceStatusBadge } from "@/components/platform/invoice-status-badge";

export const dynamic = "force-dynamic";

export default async function PlatformInvoicesPage() {
  const invoices = await prisma.tenantInvoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { tenant: true },
    take: 200,
  });
  const totals = await prisma.tenantInvoice.aggregate({
    _sum: { totalXof: true },
    where: { status: "PAID" },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Factures plateforme</h1>
        <div className="text-sm text-slate-400">
          Encaissé total :{" "}
          <span className="text-green-400 font-bold">
            {(totals._sum.totalXof ?? 0).toLocaleString("fr-FR")} XOF
          </span>
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Tenant</th>
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
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Aucune facture
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-100">{inv.tenant.name}</td>
                <td className="px-4 py-3 text-slate-400">
                  {inv.periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                </td>
                <td className="px-4 py-3 text-right text-slate-300">{inv.nbGyms}</td>
                <td className="px-4 py-3 text-right text-slate-100">
                  {inv.totalXof.toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {inv.dueDate.toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={inv.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/platform/invoices/${inv.id}`} className="text-blue-400 hover:text-blue-300">
                    Voir →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

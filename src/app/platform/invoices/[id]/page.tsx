import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InvoiceStatusBadge } from "@/components/platform/invoice-status-badge";
import { MarkPaidForm } from "./mark-paid-form";
import { InvoiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function InvoiceDetail({ params }: { params: { id: string } }) {
  const inv = await prisma.tenantInvoice.findUnique({
    where: { id: params.id },
    include: { tenant: true, payments: { include: { recordedBy: true } } },
  });
  if (!inv) notFound();

  return (
    <div className="space-y-6">
      <Link href="/platform/invoices" className="text-sm text-slate-400 hover:text-slate-200">
        ← Factures
      </Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{inv.tenant.name}</h1>
          <p className="text-sm text-slate-400 mt-1">
            Facture <span className="font-mono">{inv.id}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <InvoiceStatusBadge status={inv.status} />
          <a
            href={`/api/platform/invoices/${inv.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1 text-sm rounded bg-slate-800 hover:bg-slate-700"
          >
            📄 PDF
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-1 text-sm">
          <div className="text-xs uppercase text-slate-400 mb-1">Période</div>
          <div>
            {inv.periodStart.toLocaleDateString("fr-FR")} → {inv.periodEnd.toLocaleDateString("fr-FR")}
          </div>
          <div className="text-slate-400">
            Échéance : {inv.dueDate.toLocaleDateString("fr-FR")}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-1 text-sm">
          <div className="text-xs uppercase text-slate-400 mb-1">Détail</div>
          <div>
            {inv.nbGyms} salle{inv.nbGyms > 1 ? "s" : ""} × {inv.unitPriceXof.toLocaleString("fr-FR")} XOF
          </div>
          <div className="text-xl font-bold text-green-400 mt-1">
            {inv.totalXof.toLocaleString("fr-FR")} XOF
          </div>
        </div>
      </div>

      {inv.payments.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <h2 className="font-semibold mb-3">Paiements</h2>
          <ul className="text-sm space-y-2">
            {inv.payments.map((p) => (
              <li key={p.id} className="flex justify-between border-b border-slate-800 pb-2 last:border-0">
                <span>
                  {p.method} · {p.paidAt.toLocaleDateString("fr-FR")}
                  {p.externalRef && <span className="text-slate-400 ml-2">({p.externalRef})</span>}
                  {p.recordedBy && <span className="text-slate-500 ml-2">par {p.recordedBy.name}</span>}
                </span>
                <span className="text-green-400">{p.amountXof.toLocaleString("fr-FR")} XOF</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.CANCELLED && (
        <MarkPaidForm invoiceId={inv.id} />
      )}
    </div>
  );
}

import { InvoiceStatus } from "@prisma/client";

const STYLE: Record<InvoiceStatus, string> = {
  PENDING: "bg-amber-950 text-amber-300 border-amber-900",
  PAID: "bg-green-950 text-green-300 border-green-900",
  OVERDUE: "bg-red-950 text-red-300 border-red-900",
  CANCELLED: "bg-slate-950 text-slate-400 border-slate-800",
};
const LABEL: Record<InvoiceStatus, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-block text-xs font-medium px-2 py-1 rounded border ${STYLE[status]}`}>
      {LABEL[status]}
    </span>
  );
}

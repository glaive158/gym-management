import { TenantStatus } from "@prisma/client";

const STYLES: Record<TenantStatus, string> = {
  PENDING: "bg-amber-950 text-amber-300 border-amber-900",
  ACTIVE: "bg-green-950 text-green-300 border-green-900",
  SUSPENDED: "bg-orange-950 text-orange-300 border-orange-900",
  REJECTED: "bg-red-950 text-red-300 border-red-900",
};

const LABELS: Record<TenantStatus, string> = {
  PENDING: "En attente",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
  REJECTED: "Refusé",
};

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return (
    <span className={`inline-block text-xs font-medium px-2 py-1 rounded border ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}

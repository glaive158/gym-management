import { redirect } from "next/navigation";
import { GymForm } from "@/components/admin/gym-form";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";

export const dynamic = "force-dynamic";

export default async function NewGymPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const [tenant, count] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { gymQuota: true } }),
    tenantPrisma(prisma, ctx.tenantId).gym.count(),
  ]);
  if (count >= (tenant?.gymQuota ?? 1)) redirect("/admin/upgrade");

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Nouvelle salle</h1>
      <GymForm submitLabel="Créer la salle" endpoint="/api/admin/gyms" method="POST" redirectTo="/admin/gyms" />
    </div>
  );
}

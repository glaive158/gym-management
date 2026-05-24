import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listGyms } from "@/lib/server-actions/gym-crud";
import { ManagerForm } from "../manager-form";

export const dynamic = "force-dynamic";

export default async function NewManagerPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");
  const gyms = await listGyms({ tenantId: ctx.tenantId, prisma });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Inviter un gérant</h1>
      <ManagerForm gyms={gyms.map(g => ({ id: g.id, name: g.name }))} />
    </div>
  );
}

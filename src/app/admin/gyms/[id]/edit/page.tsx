import { notFound, redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { tenantPrisma } from "@/lib/prisma-tenant";
import { GymForm } from "@/components/admin/gym-form";

export const dynamic = "force-dynamic";

export default async function EditGymPage({ params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const scoped = tenantPrisma(prisma, ctx.tenantId);
  const gym = await scoped.gym.findUnique({ where: { id: params.id } });
  if (!gym) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Modifier {gym.name}</h1>
      <GymForm
        submitLabel="Enregistrer"
        endpoint={`/api/admin/gyms/${gym.id}`}
        method="PATCH"
        redirectTo={`/admin/gyms/${gym.id}`}
        initial={{
          name: gym.name, address: gym.address, city: gym.city, phone: gym.phone,
          latitude: gym.latitude.toString(), longitude: gym.longitude.toString(),
        }}
      />
    </div>
  );
}

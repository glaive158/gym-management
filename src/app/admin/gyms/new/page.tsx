import { GymForm } from "@/components/admin/gym-form";

export default function NewGymPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Nouvelle salle</h1>
      <GymForm submitLabel="Créer la salle" endpoint="/api/admin/gyms" method="POST" redirectTo="/admin/gyms" />
    </div>
  );
}

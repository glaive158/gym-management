"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GymDeleteButton({ gym }: { gym: { id: string; name: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Supprimer la salle « ${gym.name} » ? Action irréversible.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/gyms/${gym.id}`, { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Erreur");
      return;
    }
    router.push("/admin/gyms");
    router.refresh();
  }

  return (
    <button onClick={remove} disabled={busy}
      className="px-3 py-2 rounded border border-red-900 text-red-400 hover:bg-red-950 text-sm disabled:opacity-50">
      Supprimer
    </button>
  );
}

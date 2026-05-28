"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManagerDeactivateButton({ manager }: { manager: { id: string; name: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function deactivate() {
    if (!confirm(`Désactiver le gérant « ${manager.name} » ? Il ne pourra plus se connecter.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/managers/${manager.id}/deactivate`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Erreur");
      return;
    }
    router.refresh();
  }

  return (
    <button onClick={deactivate} disabled={busy} className="text-red-400 hover:text-red-300 text-sm disabled:opacity-50">
      Désactiver
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MemberRowActions({ member }: { member: { id: string; name: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Supprimer le membre « ${member.name} » ? Son historique est conservé.`)) return;
    setBusy(true);
    const res = await fetch(`/api/manager/members/${member.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Erreur");
      return;
    }
    router.refresh();
  }

  return (
    <button onClick={remove} disabled={busy} className="text-red-400 hover:text-red-300 disabled:opacity-50">
      Supprimer
    </button>
  );
}

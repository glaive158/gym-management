"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubscriptionCancel({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!confirm("Annuler cet abonnement ?")) return;
    setBusy(true);
    const res = await fetch(`/api/manager/subscriptions/${subscriptionId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Erreur");
      return;
    }
    router.refresh();
  }

  return (
    <button onClick={cancel} disabled={busy} className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50">
      Annuler
    </button>
  );
}

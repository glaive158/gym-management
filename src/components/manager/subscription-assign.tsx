"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubscriptionAssign({
  memberId,
  plans,
}: {
  memberId: string;
  plans: Array<{ id: string; name: string; durationDays: number; price: number; currency: string }>;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!planId) return;
    setError(null);
    setLoading(true);
    const res = await fetch("/api/manager/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, planId }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    router.refresh();
  }

  if (plans.length === 0) {
    return <p className="text-sm text-amber-400">Aucune formule active. Créez-en une d&apos;abord.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 flex items-end gap-2 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm mb-1 text-slate-300">Formule</label>
        <select value={planId} onChange={(e) => setPlanId(e.target.value)}
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100">
          {plans.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.durationDays}j — {p.price.toLocaleString("fr-FR")} {p.currency}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={loading}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium">
        {loading ? "..." : "Attribuer"}
      </button>
      {error && <p className="text-sm text-red-400 w-full">{error}</p>}
    </form>
  );
}

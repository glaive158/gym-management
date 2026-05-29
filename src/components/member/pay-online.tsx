"use client";

import { useState } from "react";

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  durationDays: number;
}

export function PayOnline({ plans }: { plans: Plan[] }) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/payments/paydunya/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.redirectUrl) {
      setLoading(false);
      setError(j.error ?? "Paiement indisponible");
      return;
    }
    window.location.href = j.redirectUrl;
  }

  if (plans.length === 0) {
    return <p className="text-sm text-slate-500">Aucune formule disponible.</p>;
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm";
  return (
    <div className="space-y-3 max-w-sm">
      <select className={inputCls} value={planId} onChange={(e) => setPlanId(e.target.value)}>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.price.toLocaleString("fr-FR")} {p.currency} ({p.durationDays}j)
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={pay} disabled={loading}
        className="w-full px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-medium">
        {loading ? "Redirection…" : "Payer en ligne (PayDunya)"}
      </button>
    </div>
  );
}

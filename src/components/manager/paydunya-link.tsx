"use client";

import { useState } from "react";

interface Plan { id: string; name: string; price: number; currency: string; durationDays: number; }

export function PaydunyaLink({ memberId, plans }: { memberId: string; plans: Plan[] }) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setLink(null);
    setLoading(true);
    const res = await fetch("/api/payments/paydunya/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, planId }),
    });
    const j = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok || !j.redirectUrl) {
      setError(j.error ?? "Indisponible");
      return;
    }
    setLink(j.redirectUrl);
  }

  if (plans.length === 0) return <p className="text-sm text-slate-500">Créez une formule d&apos;abord.</p>;

  const inputCls = "px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm";
  return (
    <div className="space-y-3 max-w-lg">
      <div className="flex gap-2">
        <select className={inputCls} value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {p.price.toLocaleString("fr-FR")} {p.currency}</option>
          ))}
        </select>
        <button onClick={generate} disabled={loading}
          className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium">
          {loading ? "…" : "Générer le lien"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {link && (
        <div className="bg-slate-900 border border-slate-800 rounded p-3 space-y-2">
          <div className="text-xs text-slate-300 font-mono break-all">{link}</div>
          <button onClick={() => navigator.clipboard.writeText(link)}
            className="text-xs text-blue-400 hover:text-blue-300">Copier le lien</button>
        </div>
      )}
    </div>
  );
}

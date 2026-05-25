"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkPaidForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [method, setMethod] = useState("MANUAL_TRANSFER");
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/platform/invoices/${invoiceId}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, externalRef: ref || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    router.refresh();
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 text-sm";
  return (
    <form onSubmit={submit} className="space-y-3 bg-slate-900 border border-slate-800 rounded p-4">
      <h3 className="font-semibold">Marquer payée</h3>
      <div>
        <label className="block text-xs mb-1 text-slate-400">Méthode</label>
        <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="MANUAL_TRANSFER">Virement</option>
          <option value="WAVE">Wave</option>
          <option value="ORANGE_MONEY">Orange Money</option>
          <option value="PAYDUNYA">PayDunya</option>
        </select>
      </div>
      <div>
        <label className="block text-xs mb-1 text-slate-400">Référence transaction (optionnel)</label>
        <input
          className={inputCls}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Ex : WV-2026-001"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50 text-sm font-medium"
      >
        {loading ? "..." : "Confirmer paiement"}
      </button>
    </form>
  );
}

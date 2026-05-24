"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PlanForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", durationDays: "30", price: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/manager/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        durationDays: parseInt(form.durationDays, 10),
        price: parseInt(form.price, 10),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    router.push("/manager/plans");
    router.refresh();
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";
  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-md">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Nom (ex: Mensuel, Trimestriel)</label>
        <input className={inputCls} required value={form.name} onChange={update("name")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1 text-slate-300">Durée (jours)</label>
          <input className={inputCls} required type="number" min="1" value={form.durationDays} onChange={update("durationDays")} />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-300">Prix (XOF)</label>
          <input className={inputCls} required type="number" min="1" value={form.price} onChange={update("price")} />
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium">
        {loading ? "..." : "Créer la formule"}
      </button>
    </form>
  );
}

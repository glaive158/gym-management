"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  plan: { id: string; name: string; durationDays: number; price: number };
}

export function PlanRowActions({ plan }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(plan.name);
  const [durationDays, setDurationDays] = useState(String(plan.durationDays));
  const [price, setPrice] = useState(String(plan.price));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/manager/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, durationDays: Number(durationDays), price: Number(price) }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Désactiver la formule « ${plan.name} » ?`)) return;
    setBusy(true);
    const res = await fetch(`/api/manager/plans/${plan.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Erreur");
      return;
    }
    router.refresh();
  }

  if (editing) {
    const inputCls = "w-24 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm";
    return (
      <div className="flex items-center gap-2 justify-end flex-wrap">
        <input className={`${inputCls} w-32`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" />
        <input className={inputCls} type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} placeholder="Jours" />
        <input className={inputCls} type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Prix" />
        <button onClick={save} disabled={busy} className="text-green-400 hover:text-green-300 text-sm disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-200 text-sm">Annuler</button>
        {error && <span className="text-xs text-red-400 w-full text-right">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 justify-end">
      <button onClick={() => setEditing(true)} className="text-blue-400 hover:text-blue-300 text-sm">Modifier</button>
      <button onClick={remove} disabled={busy} className="text-red-400 hover:text-red-300 text-sm disabled:opacity-50">Supprimer</button>
    </div>
  );
}

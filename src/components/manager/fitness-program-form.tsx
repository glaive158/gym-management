"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { managerCreateProgram } from "@/lib/server-actions/fitness-actions";
import type { FitnessProgramType } from "@prisma/client";

const TYPES: { value: FitnessProgramType; label: string }[] = [
  { value: "FULL_BODY", label: "Full Body" },
  { value: "GAINAGE_ABDOS", label: "Gainage & Abdos" },
  { value: "JAMBES_FESSIERS", label: "Jambes & Fessiers" },
  { value: "HAUT_CORPS", label: "Haut du Corps" },
  { value: "CUSTOM", label: "Personnalisé" },
];

export function FitnessProgramForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#C8FF00");
  const [type, setType] = useState<FitnessProgramType>("CUSTOM");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const r = await managerCreateProgram({ name, color, type });
    setSaving(false);
    if (r.success) router.push(`/manager/fitness/${r.data.id}`);
    else setError(r.error);
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm text-slate-400 mb-1">Nom</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm" />
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value as FitnessProgramType)}
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm">
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Couleur</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          className="h-10 w-20 rounded bg-slate-900 border border-slate-700" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button disabled={saving} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-50">
        {saving ? "..." : "Créer"}
      </button>
    </form>
  );
}

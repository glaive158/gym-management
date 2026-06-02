"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { managerAddExercise, managerDeleteExercise } from "@/lib/server-actions/fitness-actions";
import type { ExerciseDTO } from "@/components/member/fitness/types";

export function FitnessExerciseEditor({ programId, exercises }: { programId: string; exercises: ExerciseDTO[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "", steps: "", tip: "" });
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await managerAddExercise({
      programId, name: form.name, sets: form.sets, repsOrDurationSec: form.repsOrDurationSec,
      recoverySec: form.recoverySec, muscles: form.muscles,
      steps: form.steps.split("\n").map((s) => s.trim()).filter(Boolean),
      tip: form.tip || null,
    });
    setSaving(false);
    setForm({ name: "", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "", steps: "", tip: "" });
    router.refresh();
  }

  async function remove(id: string) {
    await managerDeleteExercise(id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {exercises.map((ex) => (
          <li key={ex.id} className="flex justify-between items-center bg-slate-900 border border-slate-800 rounded p-3">
            <div>
              <span className="font-medium">{ex.name}</span>
              <span className="text-sm text-slate-400 ml-2">
                {ex.sets} × {ex.repsOrDurationSec >= 100 ? `${ex.repsOrDurationSec}s` : `${ex.repsOrDurationSec} reps`} · {ex.muscles}
              </span>
            </div>
            <button onClick={() => remove(ex.id)} className="text-red-400 text-sm hover:text-red-300">Supprimer</button>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="space-y-3 bg-slate-900 border border-slate-800 rounded p-4">
        <h3 className="font-medium">Ajouter un exercice</h3>
        <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
          className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
        <div className="grid grid-cols-3 gap-2">
          <input type="number" placeholder="Séries" value={form.sets} onChange={(e) => setForm({ ...form, sets: +e.target.value })}
            className="px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
          <input type="number" placeholder="Reps/sec (>=100 = sec)" value={form.repsOrDurationSec} onChange={(e) => setForm({ ...form, repsOrDurationSec: +e.target.value })}
            className="px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
          <input type="number" placeholder="Récup (s)" value={form.recoverySec} onChange={(e) => setForm({ ...form, recoverySec: +e.target.value })}
            className="px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
        </div>
        <input placeholder="Muscles ciblés" value={form.muscles} onChange={(e) => setForm({ ...form, muscles: e.target.value })}
          className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
        <textarea placeholder="Étapes (une par ligne)" value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} rows={5}
          className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
        <input placeholder="Conseil clé" value={form.tip} onChange={(e) => setForm({ ...form, tip: e.target.value })}
          className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
        <button disabled={saving} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-50">
          {saving ? "..." : "Ajouter"}
        </button>
      </form>
    </div>
  );
}

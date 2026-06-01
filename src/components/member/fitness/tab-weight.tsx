"use client";
import { useState } from "react";
import type { useFitApp } from "@/hooks/use-fit-app";

export function TabWeight({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const { profile, weights, sessions } = fit.data;
  const [weight, setWeight] = useState("");
  const [sleep, setSleep] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  if (!profile) return null;
  const latest = weights.length ? weights[weights.length - 1].weightKg : profile.startWeightKg;
  const lost = profile.startWeightKg - latest;
  const remaining = latest - profile.goalWeightKg;

  const last14 = weights.slice(-14);
  const max = Math.max(profile.startWeightKg, ...last14.map((w) => w.weightKg));
  const min = Math.min(profile.goalWeightKg, ...last14.map((w) => w.weightKg));
  const range = max - min || 1;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(weight);
    if (Number.isNaN(w)) return;
    const iso = new Date(date).toISOString();
    const s = sleep ? parseFloat(sleep) : NaN;
    fit.addWeight({ date: iso, weightKg: w }, Number.isNaN(s) ? undefined : { date: iso, hours: s });
    setWeight(""); setSleep("");
  }

  return (
    <div className="p-4 space-y-6">
      <div className="text-center">
        <p className="text-5xl font-bold">{latest.toFixed(1)}<span className="text-lg text-slate-400"> kg</span></p>
        <div className="flex justify-center gap-6 mt-2 text-sm">
          <span className="text-green-400">−{Math.max(0, lost).toFixed(1)} kg perdus</span>
          <span className="text-orange-400">{Math.max(0, remaining).toFixed(1)} kg restants</span>
        </div>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <p className="text-sm text-slate-400 mb-3">14 dernières pesées</p>
        <div className="flex items-end justify-between gap-1 h-32">
          {last14.length === 0 && <p className="text-slate-500 text-sm">Aucune pesée.</p>}
          {last14.map((w, i) => {
            const h = 10 + ((max - w.weightKg) / range) * 0 + ((w.weightKg - min) / range) * 90;
            return <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max(8, h)}%`, background: "#C8FF00" }} title={`${w.weightKg} kg`} />;
          })}
        </div>
      </section>

      <form onSubmit={submit} className="space-y-3 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Poids (kg)</label>
            <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required
              className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sommeil (h)</label>
            <input type="number" step="0.5" value={sleep} onChange={(e) => setSleep(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm" />
        </div>
        <button className="w-full py-2 rounded font-semibold text-slate-900" style={{ background: "#C8FF00" }}>Enregistrer</button>
      </form>

      <section>
        <p className="text-sm text-slate-400 mb-2">5 dernières séances</p>
        <ul className="space-y-1">
          {sessions.slice(0, 5).map((s, i) => (
            <li key={i} className="flex justify-between text-sm bg-slate-900 border border-slate-800 rounded px-3 py-2">
              <span>{s.programName}</span>
              <span className="text-slate-400">{new Date(s.date).toLocaleDateString("fr-FR")} · {s.durationMin} min</span>
            </li>
          ))}
          {sessions.length === 0 && <li className="text-slate-500 text-sm">Aucune séance enregistrée.</li>}
        </ul>
      </section>
    </div>
  );
}

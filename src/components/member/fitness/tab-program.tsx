"use client";
import { useState } from "react";
import type { useFitApp } from "@/hooks/use-fit-app";
import { weekTargetWeight, currentWeek } from "@/lib/fitness-utils";
import { weekCalories, DAY_ICONS } from "@/lib/fitness-defaults";

export function TabProgram({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const { profile, weekData } = fit.data;
  const total = profile?.durationWeeks ?? 8;
  const live = profile ? currentWeek(new Date(profile.startDate), new Date(), total) : 1;
  const [selected, setSelected] = useState(live);

  if (!profile) return null;
  const target = weekTargetWeight(profile.startWeightKg, profile.goalWeightKg, selected, total);
  const days = weekData[selected - 1] ?? [];

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-lg font-semibold">Programme {total} semaines</h1>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: total }, (_, i) => i + 1).map((w) => (
          <button key={w} onClick={() => setSelected(w)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm border ${selected === w ? "border-lime-400 text-lime-300" : "border-slate-700 text-slate-400"}`}>
            S{w}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex justify-between">
        <div>
          <p className="text-xs text-slate-400">Objectif poids</p>
          <p className="text-xl font-bold">{target.toFixed(1)} kg</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Calories / jour</p>
          <p className="text-xl font-bold">{weekCalories(selected)}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {days.map((d, i) => (
          <li key={i}
            className="flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-lg p-3 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{DAY_ICONS[d.type]}</span>
              <div>
                <p className="font-medium">{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][i]} · {d.label}</p>
                {d.durationMin && <p className="text-sm text-slate-400">{d.durationMin} min</p>}
              </div>
            </div>
            <button onClick={() => fit.toggleDay(selected - 1, i)} className="text-2xl">
              {d.done ? "✅" : "⚪"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

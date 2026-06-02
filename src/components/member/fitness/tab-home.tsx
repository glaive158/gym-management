"use client";
import type { useFitApp } from "@/hooks/use-fit-app";
import { currentWeek, weekTargetWeight } from "@/lib/fitness-utils";
import { DAY_ICONS } from "@/lib/fitness-defaults";

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export function TabHome({
  fit,
  onNav,
}: {
  fit: ReturnType<typeof useFitApp>;
  onNav: (t: "home" | "walk" | "program" | "muscu" | "weight") => void;
}) {
  const { profile, weekData, weights } = fit.data;
  if (!profile) return null;

  const total = profile.durationWeeks;
  const week = currentWeek(new Date(profile.startDate), new Date(), total);
  const latest = weights.length ? weights[weights.length - 1].weightKg : profile.startWeightKg;
  const target = weekTargetWeight(profile.startWeightKg, profile.goalWeightKg, week, total);

  const span = profile.startWeightKg - profile.goalWeightKg;
  const done = profile.startWeightKg - latest;
  const pct = span > 0 ? Math.max(0, Math.min(100, (done / span) * 100)) : 0;

  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0
  const today = weekData[week - 1]?.[todayIdx];

  return (
    <div className="p-4 space-y-5">
      <header className="flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-400">Semaine {week}/{total}</p>
          <p className="text-2xl font-bold">{latest.toFixed(1)} kg</p>
        </div>
        <span className="text-3xl">{today ? DAY_ICONS[today.type] : "💪"}</span>
      </header>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">{profile.startWeightKg} kg</span>
          <span style={{ color: "#C8FF00" }}>Cible S{week}: {target.toFixed(1)} kg</span>
          <span className="text-slate-400">{profile.goalWeightKg} kg</span>
        </div>
        <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#C8FF00", transition: "width 0.5s" }} />
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <p className="text-sm text-slate-400 mb-1">Aujourd&apos;hui</p>
        {today ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{DAY_ICONS[today.type]} {today.label}</p>
              {today.durationMin && <p className="text-sm text-slate-400">{today.durationMin} min</p>}
            </div>
            <button onClick={() => onNav(today.type === "marche" ? "walk" : today.type === "muscu" ? "muscu" : "program")}
              className="px-3 py-1.5 rounded text-sm font-medium text-slate-900" style={{ background: "#C8FF00" }}>
              Commencer
            </button>
          </div>
        ) : <p className="text-slate-500 text-sm">Repos</p>}
      </section>

      <section>
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((d, i) => {
            const day = weekData[week - 1]?.[i];
            return (
              <div key={i} className={`flex flex-col items-center py-2 rounded ${i === todayIdx ? "bg-slate-800" : ""}`}>
                <span className="text-xs text-slate-400">{d}</span>
                <span className="text-lg">{day ? DAY_ICONS[day.type] : "·"}</span>
                <span className="text-xs">{day?.done ? "✅" : "⚪"}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <button onClick={() => onNav("walk")} className="py-3 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-sm transition-colors">🚶 Marche Japonaise</button>
        <button onClick={() => onNav("muscu")} className="py-3 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-sm transition-colors">💪 Circuit Abdos</button>
        <button onClick={() => onNav("weight")} className="py-3 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-sm transition-colors">⚖️ Peser & Suivre</button>
        <button onClick={() => onNav("program")} className="py-3 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 text-sm transition-colors">📅 Programme</button>
      </section>
    </div>
  );
}

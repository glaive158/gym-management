"use client";
import { useState } from "react";
import Link from "next/link";
import { useFitApp } from "@/hooks/use-fit-app";
import type { ProgramDTO, FitProfile } from "@/components/member/fitness/types";
import { TabHome } from "@/components/member/fitness/tab-home";
import { TabWalk } from "@/components/member/fitness/tab-walk";
import { TabProgram } from "@/components/member/fitness/tab-program";
import { TabMuscu } from "@/components/member/fitness/tab-muscu";
import { TabWeight } from "@/components/member/fitness/tab-weight";

type Tab = "home" | "walk" | "program" | "muscu" | "weight";

const NAV: { id: Tab; icon: string; label: string }[] = [
  { id: "home", icon: "🏠", label: "Accueil" },
  { id: "walk", icon: "🚶", label: "Marche" },
  { id: "program", icon: "📅", label: "Programme" },
  { id: "muscu", icon: "💪", label: "Muscu" },
  { id: "weight", icon: "⚖️", label: "Suivi" },
];

export function FitnessTracker({ programs, memberId }: { programs: ProgramDTO[]; memberId: string }) {
  const fit = useFitApp();
  const [tab, setTab] = useState<Tab>("home");

  if (!fit.loaded) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Chargement…</div>;
  }

  if (!fit.data.profile) {
    return <Onboarding onDone={fit.setProfile} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <div className="max-w-md mx-auto">
        <div className="px-4 pt-4">
          <Link href="/me"
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-100">
            <span aria-hidden>←</span> Tableau de bord
          </Link>
        </div>
        {tab === "home" && <TabHome fit={fit} onNav={setTab} />}
        {tab === "walk" && <TabWalk fit={fit} />}
        {tab === "program" && <TabProgram fit={fit} />}
        {tab === "muscu" && <TabMuscu programs={programs} memberId={memberId} fit={fit} />}
        {tab === "weight" && <TabWeight fit={fit} />}
      </div>

      <nav className="fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className="relative flex flex-col items-center py-2 text-xs">
              {tab === n.id && <span className="absolute top-0 inset-x-4 h-0.5" style={{ background: "#C8FF00" }} />}
              <span className="text-lg">{n.icon}</span>
              <span className={tab === n.id ? "text-slate-100" : "text-slate-500"}>{n.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Onboarding({ onDone }: { onDone: (p: FitProfile) => void }) {
  const [start, setStart] = useState(92);
  const [goal, setGoal] = useState(85);
  const [weeks, setWeeks] = useState<4 | 8 | 12>(8);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <Link href="/me"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-100">
          <span aria-hidden>←</span> Tableau de bord
        </Link>
        <h1 className="text-xl font-semibold text-center">Configure ton programme</h1>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Poids actuel (kg)</label>
          <input type="number" step="0.1" value={start} onChange={(e) => setStart(+e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Poids objectif (kg)</label>
          <input type="number" step="0.1" value={goal} onChange={(e) => setGoal(+e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Durée</label>
          <div className="grid grid-cols-3 gap-2">
            {[4, 8, 12].map((w) => (
              <button key={w} onClick={() => setWeeks(w as 4 | 8 | 12)}
                className={`py-2 rounded text-sm border ${weeks === w ? "border-lime-400 text-lime-300" : "border-slate-700 text-slate-400"}`}>
                {w} sem
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => onDone({ startWeightKg: start, goalWeightKg: goal, durationWeeks: weeks, startDate: new Date().toISOString() })}
          className="w-full py-3 rounded font-semibold text-slate-900" style={{ background: "#C8FF00" }}>
          Démarrer
        </button>
      </div>
    </div>
  );
}

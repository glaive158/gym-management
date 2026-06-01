"use client";
import { useEffect, useRef, useState } from "react";
import type { useFitApp } from "@/hooks/use-fit-app";
import { CircularTimer } from "@/components/member/fitness/circular-timer";
import { walkCalories } from "@/lib/fitness-utils";

const WALK_SEC = 120;   // 2 min @ 6 km/h
const FAST_SEC = 180;   // 3 min @ 8 km/h
const CYCLE_SEC = WALK_SEC + FAST_SEC;
const TOTAL_SEC = 30 * 60;

function phaseAt(elapsed: number): { phase: "MARCHE" | "RAPIDE"; speed: number; remaining: number } {
  const inCycle = elapsed % CYCLE_SEC;
  if (inCycle < WALK_SEC) return { phase: "MARCHE", speed: 6, remaining: WALK_SEC - inCycle };
  return { phase: "RAPIDE", speed: 8, remaining: CYCLE_SEC - inCycle };
}

export function TabWalk({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setElapsed((e) => Math.min(e + 1, TOTAL_SEC)), 1000);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  useEffect(() => { if (elapsed >= TOTAL_SEC) setRunning(false); }, [elapsed]);

  const done = elapsed >= TOTAL_SEC;
  const { phase, speed, remaining } = phaseAt(elapsed);
  const cycles = Math.floor(elapsed / CYCLE_SEC);
  const kcal = walkCalories(elapsed / 60);
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  function reset() { setRunning(false); setElapsed(0); }
  function save() {
    fit.addSession({ date: new Date().toISOString(), programId: "walk", programName: "Marche Japonaise", durationMin: Math.round(elapsed / 60) });
    reset();
  }

  if (done) {
    return (
      <div className="p-4 space-y-5 text-center">
        <h1 className="text-xl font-semibold">Séance terminée 🎉</h1>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Cycles" value={`${cycles}`} />
          <Stat label="Calories" value={`${kcal}`} />
          <Stat label="Durée" value={`${Math.round(elapsed / 60)} min`} />
        </div>
        <button onClick={save} className="w-full py-3 rounded font-semibold text-slate-900" style={{ background: "#C8FF00" }}>Enregistrer</button>
        <button onClick={reset} className="w-full py-2 rounded bg-slate-800 text-sm">Recommencer</button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 flex flex-col items-center">
      <h1 className="text-lg font-semibold self-start">Marche Japonaise</h1>
      <CircularTimer progress={remaining / (phase === "MARCHE" ? WALK_SEC : FAST_SEC)} color={phase === "RAPIDE" ? "#FF6B35" : "#C8FF00"}>
        <span className="text-sm text-slate-400">{phase}</span>
        <span className="text-4xl font-bold">{mm(remaining)}</span>
        <span className="text-sm text-slate-400">{speed} km/h</span>
      </CircularTimer>
      <div className="grid grid-cols-3 gap-2 w-full">
        <Stat label="Total" value={mm(elapsed)} />
        <Stat label="Cycles" value={`${cycles}`} />
        <Stat label="Kcal" value={`${kcal}`} />
      </div>
      <div className="flex gap-2 w-full">
        <button onClick={() => setRunning((r) => !r)} className="flex-1 py-3 rounded font-semibold text-slate-900" style={{ background: "#C8FF00" }}>
          {running ? "Pause" : "Démarrer"}
        </button>
        <button onClick={reset} className="px-4 py-3 rounded bg-slate-800 text-sm">↺</button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded p-3 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

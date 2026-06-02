"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { useFitApp } from "@/hooks/use-fit-app";
import type { ProgramDTO } from "@/components/member/fitness/types";
import { SessionOverlay } from "@/components/member/fitness/session-overlay";
import { memberCreateProgram } from "@/lib/server-actions/fitness-actions";

export function TabMuscu({
  programs,
  memberId,
  fit,
}: {
  programs: ProgramDTO[];
  memberId: string;
  fit: ReturnType<typeof useFitApp>;
}) {
  const router = useRouter();
  const [active, setActive] = useState<ProgramDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const gymPrograms = programs.filter((p) => p.createdById === null);
  const myPrograms = programs.filter((p) => p.createdById === memberId);

  async function create() {
    if (!name.trim()) return;
    const r = await memberCreateProgram({ name, color: "#C8FF00" });
    setCreating(false); setName("");
    if (r.success) router.refresh();
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-lg font-semibold">Renforcement musculaire</h1>

      <section className="space-y-2">
        <h2 className="text-sm text-slate-400">Programmes de ta salle</h2>
        {gymPrograms.map((p) => <ProgramCard key={p.id} program={p} onStart={() => setActive(p)} />)}
        {gymPrograms.length === 0 && <p className="text-slate-500 text-sm">Aucun programme de salle.</p>}
      </section>

      <section className="space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="text-sm text-slate-400">Mes programmes</h2>
          <button onClick={() => setCreating((v) => !v)} className="text-sm" style={{ color: "#C8FF00" }}>+ Créer</button>
        </div>
        {creating && (
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du programme"
              className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm" />
            <button onClick={create} className="px-3 py-2 rounded text-sm font-medium text-slate-900" style={{ background: "#C8FF00" }}>OK</button>
          </div>
        )}
        {myPrograms.map((p) => <ProgramCard key={p.id} program={p} onStart={() => setActive(p)} />)}
        {myPrograms.length === 0 && !creating && <p className="text-slate-500 text-sm">Crée ton premier programme.</p>}
      </section>

      {active && active.exercises.length > 0 && (
        <SessionOverlay
          program={active}
          onClose={() => setActive(null)}
          onFinish={(min) => fit.addSession({ date: new Date().toISOString(), programId: active.id, programName: active.name, durationMin: min })}
        />
      )}
    </div>
  );
}

function ProgramCard({ program, onStart }: { program: ProgramDTO; onStart: () => void }) {
  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-lg p-4 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ background: program.color }} />
          <div>
            <p className="font-medium">{program.name}</p>
            <p className="text-sm text-slate-400">{program.exercises.length} exercices</p>
          </div>
        </div>
        <button onClick={onStart} disabled={program.exercises.length === 0}
          className="px-3 py-1.5 rounded text-sm font-medium text-slate-900 disabled:opacity-40" style={{ background: program.color }}>
          Démarrer
        </button>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { CircularTimer } from "@/components/member/fitness/circular-timer";
import type { ProgramDTO } from "@/components/member/fitness/types";

type Phase = "ready" | "work" | "recovery" | "done";

export function SessionOverlay({
  program,
  onClose,
  onFinish,
}: {
  program: ProgramDTO;
  onClose: () => void;
  onFinish: (durationMin: number) => void;
}) {
  const exercises = program.exercises;
  const [exIdx, setExIdx] = useState(0);
  const [set, setSet] = useState(1);
  const [phase, setPhase] = useState<Phase>("ready");
  const [secLeft, setSecLeft] = useState(0);
  const startedAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const ex = exercises[exIdx];
  const isTimed = ex ? ex.repsOrDurationSec >= 100 : false;
  const workSec = ex ? ex.repsOrDurationSec : 0;

  useEffect(() => {
    if ((phase === "work" && isTimed) || phase === "recovery") {
      timer.current = setInterval(() => setSecLeft((s) => Math.max(0, s - 1)), 1000);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [phase, isTimed]);

  useEffect(() => {
    if (secLeft === 0) {
      if (phase === "work" && isTimed) finishSet();
      else if (phase === "recovery") nextAfterRecovery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secLeft]);

  if (!ex) return null;

  function startWork() {
    setPhase("work");
    if (isTimed) setSecLeft(workSec);
  }
  function finishSet() {
    if (set < ex.sets) {
      setPhase("recovery");
      setSecLeft(ex.recoverySec);
    } else {
      goNextExercise();
    }
  }
  function nextAfterRecovery() {
    setSet((s) => s + 1);
    setPhase("ready");
  }
  function skipRecovery() {
    if (timer.current) clearInterval(timer.current);
    nextAfterRecovery();
  }
  function goNextExercise() {
    if (exIdx < exercises.length - 1) {
      setExIdx((i) => i + 1);
      setSet(1);
      setPhase("ready");
    } else {
      setPhase("done");
    }
  }

  if (phase === "done") {
    const min = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    return (
      <Overlay>
        <div className="text-center space-y-5">
          <h2 className="text-2xl font-bold">Séance terminée 🎉</h2>
          <p className="text-slate-400">{exercises.length} exercices · {min} min</p>
          <button onClick={() => { onFinish(min); onClose(); }}
            className="w-full py-3 rounded font-semibold text-slate-900" style={{ background: program.color }}>
            Retour
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-slate-400 text-sm">✕ Quitter</button>
          <span className="text-sm text-slate-400">{exIdx + 1}/{exercises.length}</span>
        </div>

        <div className="flex gap-1 justify-center">
          {exercises.map((_, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i <= exIdx ? "" : "bg-slate-700"}`} style={i <= exIdx ? { background: program.color } : undefined} />
          ))}
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold">{ex.name}</h2>
          <p className="text-sm text-slate-400">{ex.muscles}</p>
          <p className="text-sm mt-1" style={{ color: program.color }}>Série {set}/{ex.sets}</p>
        </div>

        {phase === "recovery" ? (
          <div className="flex flex-col items-center gap-3">
            <CircularTimer progress={secLeft / ex.recoverySec} color="#FF6B35">
              <span className="text-sm text-slate-400">Récup</span>
              <span className="text-4xl font-bold">{secLeft}s</span>
            </CircularTimer>
            <button onClick={skipRecovery} className="text-sm text-slate-400 underline">Passer la récupération</button>
          </div>
        ) : phase === "work" && isTimed ? (
          <div className="flex justify-center">
            <CircularTimer progress={secLeft / workSec} color={program.color}>
              <span className="text-4xl font-bold">{secLeft}s</span>
            </CircularTimer>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-6xl font-bold" style={{ color: program.color }}>{ex.repsOrDurationSec}</p>
            <p className="text-slate-400">répétitions</p>
          </div>
        )}

        <div className="flex gap-1 justify-center">
          {Array.from({ length: ex.sets }, (_, i) => (
            <span key={i} className={`h-3 w-3 rounded-full ${i < set - (phase === "ready" ? 1 : 0) ? "" : "bg-slate-700"}`}
              style={i < set - (phase === "ready" ? 1 : 0) ? { background: program.color } : undefined} />
          ))}
        </div>

        {phase === "ready" && (
          <button onClick={startWork} className="w-full py-3 rounded font-semibold text-slate-900" style={{ background: program.color }}>
            {set === 1 ? "Démarrer" : "C'est parti"}
          </button>
        )}
        {phase === "work" && !isTimed && (
          <button onClick={finishSet} className="w-full py-3 rounded font-semibold text-slate-900" style={{ background: program.color }}>
            Série faite → Récup
          </button>
        )}
        {phase === "work" && (
          <button onClick={goNextExercise} className="w-full py-2 rounded bg-slate-800 text-sm">Passer l&apos;exercice</button>
        )}
      </div>
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

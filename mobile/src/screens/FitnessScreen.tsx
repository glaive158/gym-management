import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useFitApp } from "../hooks/useFitApp";
import { fetchPrograms, walkCalories, type ProgramDTO } from "../lib/fitness";

const ACCENT = "#C8FF00";
const TABS = ["Programme", "Muscu", "Marche", "Poids"] as const;
type TabKey = (typeof TABS)[number];

export function FitnessScreen() {
  const [tab, setTab] = useState<TabKey>("Programme");
  const fit = useFitApp();
  return (
    <View style={s.root}>
      <View style={s.tabbar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === "Programme" && <ProgrammeTab fit={fit} />}
      {tab === "Muscu" && <MuscuTab fit={fit} />}
      {tab === "Marche" && <MarcheTab fit={fit} />}
      {tab === "Poids" && <PoidsTab fit={fit} />}
    </View>
  );
}

function ProgrammeTab({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const { data } = fit;
  if (!data.profile) {
    return <ProfileSetup fit={fit} />;
  }
  return (
    <ScrollView contentContainerStyle={s.pad}>
      {data.weekData.map((week, wi) => (
        <View key={wi} style={s.card}>
          <Text style={s.h2}>Semaine {wi + 1}</Text>
          {week.map((d, di) => (
            <TouchableOpacity key={di} style={s.dayRow} onPress={() => fit.toggleDay(wi, di)}>
              <Text style={[s.dayTxt, d.done && s.dayDone]}>
                {d.done ? "☑" : "☐"} {d.label}{d.durationMin ? ` · ${d.durationMin} min` : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function ProfileSetup({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const [start, setStart] = useState("");
  const [goal, setGoal] = useState("");
  const [weeks, setWeeks] = useState<4 | 8 | 12>(8);
  function save() {
    const sw = parseFloat(start), gw = parseFloat(goal);
    if (Number.isNaN(sw) || Number.isNaN(gw)) return;
    fit.setProfile({ startWeightKg: sw, goalWeightKg: gw, durationWeeks: weeks, startDate: new Date().toISOString() });
  }
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.h1}>Configure ton programme</Text>
      <Text style={s.label}>Poids de départ (kg)</Text>
      <TextInput style={s.input} keyboardType="numeric" value={start} onChangeText={setStart} />
      <Text style={s.label}>Objectif (kg)</Text>
      <TextInput style={s.input} keyboardType="numeric" value={goal} onChangeText={setGoal} />
      <Text style={s.label}>Durée</Text>
      <View style={s.row}>
        {[4, 8, 12].map((w) => (
          <TouchableOpacity key={w} style={[s.chip, weeks === w && s.chipActive]} onPress={() => setWeeks(w as 4 | 8 | 12)}>
            <Text style={[s.chipTxt, weeks === w && s.chipTxtActive]}>{w} sem.</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={s.cta} onPress={save}><Text style={s.ctaTxt}>Démarrer</Text></TouchableOpacity>
    </ScrollView>
  );
}

function MuscuTab({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const { token } = useAuth();
  const [programs, setPrograms] = useState<ProgramDTO[]>([]);
  const [active, setActive] = useState<ProgramDTO | null>(null);
  useEffect(() => { if (token) fetchPrograms(token).then(setPrograms).catch(() => {}); }, [token]);

  if (active) return <Session program={active} onDone={(min) => { fit.addSession({ date: new Date().toISOString(), programId: active.id, programName: active.name, durationMin: min }); setActive(null); }} onCancel={() => setActive(null)} />;

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.h1}>Renforcement musculaire</Text>
      {programs.length === 0 && <Text style={s.muted}>Aucun programme.</Text>}
      {programs.map((p) => (
        <TouchableOpacity key={p.id} style={s.card} onPress={() => setActive(p)}>
          <Text style={s.h2}>{p.name}</Text>
          <Text style={s.muted}>{p.exercises.length} exercices</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Session({ program, onDone, onCancel }: { program: ProgramDTO; onDone: (min: number) => void; onCancel: () => void }) {
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { ref.current = setInterval(() => setElapsed((e) => e + 1), 1000); return () => { if (ref.current) clearInterval(ref.current); }; }, []);
  const ex = program.exercises[idx];
  const isLast = idx >= program.exercises.length - 1;
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.muted}>{mm} · {idx + 1}/{program.exercises.length}</Text>
      <Text style={s.h1}>{ex.name}</Text>
      <Text style={s.body}>{ex.sets} séries × {ex.repsOrDurationSec < 100 ? `${ex.repsOrDurationSec} reps` : `${ex.repsOrDurationSec}s`}</Text>
      <Text style={s.muted}>Récup {ex.recoverySec}s · {ex.muscles}</Text>
      {ex.steps.map((st, i) => <Text key={i} style={s.body}>• {st}</Text>)}
      {ex.tip ? <Text style={s.tip}>💡 {ex.tip}</Text> : null}
      {!isLast
        ? <TouchableOpacity style={s.cta} onPress={() => setIdx((i) => i + 1)}><Text style={s.ctaTxt}>Exercice suivant</Text></TouchableOpacity>
        : <TouchableOpacity style={s.cta} onPress={() => onDone(Math.max(1, Math.round(elapsed / 60)))}><Text style={s.ctaTxt}>Terminer la séance</Text></TouchableOpacity>}
      <TouchableOpacity style={s.cancel} onPress={onCancel}><Text style={s.cancelTxt}>Abandonner</Text></TouchableOpacity>
    </ScrollView>
  );
}

const WALK_SEC = 120, FAST_SEC = 180, CYCLE = 300, TOTAL = 1800;
function MarcheTab({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (running) ref.current = setInterval(() => setElapsed((e) => Math.min(e + 1, TOTAL)), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);
  useEffect(() => { if (elapsed >= TOTAL) setRunning(false); }, [elapsed]);
  const inCycle = elapsed % CYCLE;
  const phase = inCycle < WALK_SEC ? "MARCHE (6 km/h)" : "RAPIDE (8 km/h)";
  const done = elapsed >= TOTAL;
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  function save() {
    fit.addSession({ date: new Date().toISOString(), programId: "walk", programName: "Marche Japonaise", durationMin: Math.max(1, Math.round(elapsed / 60)) });
    setElapsed(0); setRunning(false);
  }
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.h1}>Marche Japonaise</Text>
      <Text style={s.timer}>{mm}</Text>
      <Text style={s.h2}>{phase}</Text>
      <Text style={s.muted}>Calories ~{walkCalories(elapsed / 60)} kcal · 30 min cible</Text>
      {!done
        ? <TouchableOpacity style={s.cta} onPress={() => setRunning((r) => !r)}><Text style={s.ctaTxt}>{running ? "Pause" : "Démarrer"}</Text></TouchableOpacity>
        : <TouchableOpacity style={s.cta} onPress={save}><Text style={s.ctaTxt}>Enregistrer</Text></TouchableOpacity>}
      <TouchableOpacity style={s.cancel} onPress={() => { setElapsed(0); setRunning(false); }}><Text style={s.cancelTxt}>Réinitialiser</Text></TouchableOpacity>
    </ScrollView>
  );
}

// suppress unused var warning for FAST_SEC which is part of the walk constants group
void FAST_SEC;

function PoidsTab({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  const { data } = fit;
  const [weight, setWeight] = useState("");
  const [sleep, setSleep] = useState("");
  const latest = data.weights.length ? data.weights[data.weights.length - 1].weightKg : data.profile?.startWeightKg ?? 0;
  function submit() {
    const w = parseFloat(weight);
    if (Number.isNaN(w)) return;
    const iso = new Date().toISOString();
    const s2 = parseFloat(sleep);
    fit.addWeight({ date: iso, weightKg: w }, Number.isNaN(s2) ? undefined : { date: iso, hours: s2 });
    setWeight(""); setSleep("");
  }
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.timer}>{latest.toFixed(1)} kg</Text>
      <Text style={s.label}>Poids (kg)</Text>
      <TextInput style={s.input} keyboardType="numeric" value={weight} onChangeText={setWeight} />
      <Text style={s.label}>Sommeil (h) — optionnel</Text>
      <TextInput style={s.input} keyboardType="numeric" value={sleep} onChangeText={setSleep} />
      <TouchableOpacity style={s.cta} onPress={submit}><Text style={s.ctaTxt}>Enregistrer</Text></TouchableOpacity>
      <View style={{ marginTop: 16 }}>
        <Text style={s.h2}>Historique</Text>
        {data.weights.slice().reverse().map((w, i) => (
          <Text key={i} style={s.body}>{new Date(w.date).toLocaleDateString("fr-FR")} — {w.weightKg.toFixed(1)} kg</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  tabbar: { flexDirection: "row", backgroundColor: "#1e293b", borderBottomColor: "#334155", borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnActive: { borderBottomColor: ACCENT, borderBottomWidth: 2 },
  tabTxt: { color: "#94a3b8", fontSize: 13 },
  tabTxtActive: { color: ACCENT, fontWeight: "600" },
  pad: { padding: 16 },
  h1: { color: "#f1f5f9", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  h2: { color: "#f1f5f9", fontSize: 16, fontWeight: "600", marginBottom: 4 },
  body: { color: "#cbd5e1", fontSize: 14, marginVertical: 2 },
  muted: { color: "#64748b", fontSize: 13, marginVertical: 2 },
  tip: { color: ACCENT, fontSize: 13, marginTop: 6 },
  timer: { color: ACCENT, fontSize: 44, fontWeight: "800", textAlign: "center", marginVertical: 8 },
  card: { backgroundColor: "#1e293b", borderColor: "#334155", borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 12 },
  dayRow: { paddingVertical: 6 },
  dayTxt: { color: "#cbd5e1", fontSize: 14 },
  dayDone: { color: ACCENT },
  label: { color: "#94a3b8", fontSize: 12, marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: "#0f172a", borderColor: "#334155", borderWidth: 1, borderRadius: 8, color: "#f1f5f9", paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1e293b", borderColor: "#334155", borderWidth: 1 },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipTxt: { color: "#94a3b8" },
  chipTxtActive: { color: "#0f172a", fontWeight: "700" },
  cta: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  ctaTxt: { color: "#0f172a", fontWeight: "700", fontSize: 15 },
  cancel: { paddingVertical: 10, alignItems: "center", marginTop: 8 },
  cancelTxt: { color: "#64748b" },
});

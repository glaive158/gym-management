import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  fetchFitData, postProfile, postWeight, postSession, postDayProgress,
  type FitData, type FitProfile, type WeightEntry, type SleepEntry, type SessionEntry,
} from "../lib/fitness";

function empty(): FitData {
  return { profile: null, weekData: [], weights: [], sleeps: [], sessions: [] };
}

export function useFitApp() {
  const { token } = useAuth();
  const [data, setData] = useState<FitData>(empty);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    try { setData(await fetchFitData(token)); } catch { /* keep */ }
  }, [token]);

  useEffect(() => { (async () => { await refresh(); setLoaded(true); })(); }, [refresh]);

  const setProfile = useCallback(async (p: FitProfile) => {
    if (!token) return;
    setData((d) => ({ ...d, profile: p }));
    await postProfile(token, p);
    await refresh();
  }, [token, refresh]);

  const toggleDay = useCallback(async (week: number, day: number) => {
    if (!token) return;
    setData((d) => ({ ...d, weekData: d.weekData.map((w, wi) => wi === week ? w.map((dd, di) => di === day ? { ...dd, done: !dd.done } : dd) : w) }));
    await postDayProgress(token, { weekIndex: week, dayIndex: day });
  }, [token]);

  const addWeight = useCallback(async (entry: WeightEntry, sleep?: SleepEntry) => {
    if (!token) return;
    setData((d) => ({ ...d, weights: [...d.weights, entry], sleeps: sleep ? [...d.sleeps, sleep] : d.sleeps }));
    await postWeight(token, { date: entry.date, weightKg: entry.weightKg, sleepHours: sleep?.hours ?? null });
  }, [token]);

  const addSession = useCallback(async (entry: SessionEntry) => {
    if (!token) return;
    setData((d) => ({ ...d, sessions: [entry, ...d.sessions] }));
    await postSession(token, {
      date: entry.date, programId: entry.programId === "walk" ? null : entry.programId,
      programName: entry.programName, durationMin: entry.durationMin,
      kind: entry.programId === "walk" ? "marche" : "muscu",
    });
  }, [token]);

  return { data, loaded, refresh, setProfile, toggleDay, addWeight, addSession };
}

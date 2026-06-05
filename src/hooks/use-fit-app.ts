"use client";
import { useCallback, useEffect, useState } from "react";
import type { FitAppData, FitProfile, WeightEntry, SleepEntry, SessionEntry } from "@/components/member/fitness/types";

const LEGACY_KEY = "fitapp_v3";

function emptyData(): FitAppData {
  return { profile: null, weekData: [], weights: [], sleeps: [], sessions: [] };
}

async function getJSON(url: string): Promise<FitAppData> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} ${res.status}`);
  return (await res.json()) as FitAppData;
}
async function postJSON(url: string, body: unknown): Promise<void> {
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function useFitApp() {
  const [data, setData] = useState<FitAppData>(emptyData);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try { setData(await getJSON("/api/me/fitness/data")); }
    catch { /* keep current */ }
  }, []);

  useEffect(() => {
    (async () => {
      let server = emptyData();
      try { server = await getJSON("/api/me/fitness/data"); } catch { /* offline */ }
      if (!server.profile && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(LEGACY_KEY);
          if (raw) {
            const local = JSON.parse(raw) as FitAppData;
            if (local.profile) {
              await postJSON("/api/me/fitness/profile", local.profile);
              for (const w of local.weights) {
                const sleep = local.sleeps.find((s) => s.date === w.date);
                await postJSON("/api/me/fitness/weights", { ...w, sleepHours: sleep?.hours ?? null });
              }
              for (const s of local.sessions) {
                await postJSON("/api/me/fitness/sessions", { date: s.date, programId: s.programId === "walk" ? null : s.programId, programName: s.programName, durationMin: s.durationMin, kind: s.programId === "walk" ? "marche" : "muscu" });
              }
              localStorage.removeItem(LEGACY_KEY);
              server = await getJSON("/api/me/fitness/data");
            }
          }
        } catch { /* best-effort */ }
      }
      setData(server);
      setLoaded(true);
    })();
  }, []);

  const setProfile = useCallback(async (profile: FitProfile) => {
    setData((d) => ({ ...d, profile }));
    await postJSON("/api/me/fitness/profile", profile);
    await refresh();
  }, [refresh]);

  const toggleDay = useCallback(async (week: number, day: number) => {
    setData((d) => ({
      ...d,
      weekData: d.weekData.map((w, wi) => wi === week ? w.map((dd, di) => di === day ? { ...dd, done: !dd.done } : dd) : w),
    }));
    await postJSON("/api/me/fitness/day-progress", { weekIndex: week, dayIndex: day });
  }, []);

  const addWeight = useCallback(async (entry: WeightEntry, sleep?: SleepEntry) => {
    setData((d) => ({ ...d, weights: [...d.weights, entry], sleeps: sleep ? [...d.sleeps, sleep] : d.sleeps }));
    await postJSON("/api/me/fitness/weights", { ...entry, sleepHours: sleep?.hours ?? null });
  }, []);

  const addSession = useCallback(async (entry: SessionEntry) => {
    setData((d) => ({ ...d, sessions: [entry, ...d.sessions] }));
    await postJSON("/api/me/fitness/sessions", {
      date: entry.date, programId: entry.programId === "walk" ? null : entry.programId,
      programName: entry.programName, durationMin: entry.durationMin,
      kind: entry.programId === "walk" ? "marche" : "muscu",
    });
  }, []);

  const reset = useCallback(() => { setData(emptyData()); }, []);

  return { data, loaded, setProfile, toggleDay, addWeight, addSession, reset };
}

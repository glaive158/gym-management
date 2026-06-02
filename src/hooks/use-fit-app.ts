"use client";
import { useCallback, useEffect, useState } from "react";
import type { FitAppData, FitProfile, WeekDay, WeightEntry, SleepEntry, SessionEntry } from "@/components/member/fitness/types";
import type { DayType } from "@/components/member/fitness/types";
import { WEEKLY_SCHEDULE } from "@/lib/fitness-defaults";

const KEY = "fitapp_v3";

function emptyData(): FitAppData {
  return { profile: null, weekData: [], weights: [], sleeps: [], sessions: [] };
}

function buildWeekData(weeks: number): WeekDay[][] {
  return Array.from({ length: weeks }, () =>
    WEEKLY_SCHEDULE.map((d) => ({ type: d.type as DayType, label: d.label, durationMin: d.durationMin, done: false })),
  );
}

export function useFitApp() {
  const [data, setData] = useState<FitAppData>(emptyData);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setData(JSON.parse(raw) as FitAppData);
    } catch { /* ignore corrupt */ }
    setLoaded(true);
  }, []);

  const persist = useCallback((next: FitAppData) => {
    setData(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* quota */ }
  }, []);

  const setProfile = useCallback((profile: FitProfile) => {
    persist({ ...data, profile, weekData: buildWeekData(profile.durationWeeks) });
  }, [data, persist]);

  const toggleDay = useCallback((week: number, day: number) => {
    const weekData = data.weekData.map((w, wi) =>
      wi === week ? w.map((d, di) => (di === day ? { ...d, done: !d.done } : d)) : w,
    );
    persist({ ...data, weekData });
  }, [data, persist]);

  const addWeight = useCallback((entry: WeightEntry, sleep?: SleepEntry) => {
    persist({
      ...data,
      weights: [...data.weights, entry],
      sleeps: sleep ? [...data.sleeps, sleep] : data.sleeps,
    });
  }, [data, persist]);

  const addSession = useCallback((entry: SessionEntry) => {
    persist({ ...data, sessions: [entry, ...data.sessions] });
  }, [data, persist]);

  const reset = useCallback(() => persist(emptyData()), [persist]);

  return { data, loaded, setProfile, toggleDay, addWeight, addSession, reset };
}

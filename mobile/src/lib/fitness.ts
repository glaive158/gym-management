import { apiFetch } from "./api";

export interface FitProfile { startWeightKg: number; goalWeightKg: number; durationWeeks: number; startDate: string }
export interface WeekDay { type: string; label: string; durationMin: number | null; done: boolean }
export interface WeightEntry { date: string; weightKg: number }
export interface SleepEntry { date: string; hours: number }
export interface SessionEntry { date: string; programId: string; programName: string; durationMin: number }
export interface FitData {
  profile: FitProfile | null;
  weekData: WeekDay[][];
  weights: WeightEntry[];
  sleeps: SleepEntry[];
  sessions: SessionEntry[];
}
export interface ExerciseDTO {
  id: string; name: string; sets: number; repsOrDurationSec: number;
  recoverySec: number; muscles: string; steps: string[]; tip: string | null; order: number;
}
export interface ProgramDTO {
  id: string; name: string; color: string; type: string; createdById: string | null; exercises: ExerciseDTO[];
}

export const WEEKLY_SCHEDULE: { type: string; label: string; durationMin: number | null }[] = [
  { type: "muscu", label: "Full Body", durationMin: 40 },
  { type: "marche", label: "Marche Japonaise", durationMin: 30 },
  { type: "muscu", label: "Gainage & Abdos", durationMin: 35 },
  { type: "repos", label: "Repos", durationMin: null },
  { type: "muscu", label: "Jambes & Fessiers", durationMin: 40 },
  { type: "course", label: "Course", durationMin: 30 },
  { type: "yoga", label: "Yoga / Étirements", durationMin: 20 },
];

export function fetchFitData(token: string) { return apiFetch<FitData>("/api/me/fitness/data", { token }); }
export function fetchPrograms(token: string) { return apiFetch<ProgramDTO[]>("/api/me/fitness/programs", { token }); }
export function postProfile(token: string, p: FitProfile) {
  return apiFetch("/api/me/fitness/profile", { method: "POST", token, body: JSON.stringify(p) });
}
export function postWeight(token: string, body: { date: string; weightKg: number; sleepHours: number | null }) {
  return apiFetch("/api/me/fitness/weights", { method: "POST", token, body: JSON.stringify(body) });
}
export function postSession(token: string, body: { date: string; programId: string | null; programName: string; durationMin: number; kind: string }) {
  return apiFetch("/api/me/fitness/sessions", { method: "POST", token, body: JSON.stringify(body) });
}
export function postDayProgress(token: string, body: { weekIndex: number; dayIndex: number }) {
  return apiFetch("/api/me/fitness/day-progress", { method: "POST", token, body: JSON.stringify(body) });
}

export function walkCalories(minutes: number): number { return Math.round(minutes * 7); }

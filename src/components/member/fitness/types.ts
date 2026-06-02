import type { FitnessProgramType } from "@prisma/client";

export interface ExerciseDTO {
  id: string;
  name: string;
  sets: number;
  repsOrDurationSec: number; // < 100 reps, >= 100 seconds
  recoverySec: number;
  muscles: string;
  steps: string[];
  tip: string | null;
  order: number;
}

export interface ProgramDTO {
  id: string;
  name: string;
  color: string;
  type: FitnessProgramType;
  createdById: string | null; // null = gym program
  exercises: ExerciseDTO[];
}

export type DayType = "course" | "fractional" | "muscu" | "marche" | "yoga" | "repos";

export interface WeekDay {
  type: DayType;
  label: string;
  durationMin: number | null;
  done: boolean;
}

export interface FitProfile {
  startWeightKg: number;
  goalWeightKg: number;
  durationWeeks: 4 | 8 | 12;
  startDate: string; // ISO
}

export interface WeightEntry { date: string; weightKg: number }
export interface SleepEntry { date: string; hours: number }
export interface SessionEntry {
  date: string;
  programId: string;
  programName: string;
  durationMin: number;
}

export interface FitAppData {
  profile: FitProfile | null;
  weekData: WeekDay[][]; // [weekIndex][0..6] Mon..Sun
  weights: WeightEntry[];
  sleeps: SleepEntry[];
  sessions: SessionEntry[];
}

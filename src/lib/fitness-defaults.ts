import type { FitnessProgramType } from "@prisma/client";

export const DAY_ICONS: Record<string, string> = {
  course: "🏃",
  fractional: "⚡",
  muscu: "💪",
  marche: "🚶",
  yoga: "🧘",
  repos: "😴",
};

export interface ScheduleDay {
  type: keyof typeof DAY_ICONS;
  label: string;
  durationMin: number | null;
}

// Mon..Sun
export const WEEKLY_SCHEDULE: ScheduleDay[] = [
  { type: "muscu", label: "Full Body", durationMin: 40 },
  { type: "marche", label: "Marche Japonaise", durationMin: 30 },
  { type: "muscu", label: "Gainage & Abdos", durationMin: 35 },
  { type: "repos", label: "Repos", durationMin: null },
  { type: "muscu", label: "Jambes & Fessiers", durationMin: 40 },
  { type: "course", label: "Course", durationMin: 30 },
  { type: "yoga", label: "Yoga / Étirements", durationMin: 20 },
];

/** Daily calorie target by week index (1-based). Falls back to last value. */
export const WEEK_CALORIES = [2100, 2000, 2000, 1950, 1900, 1900, 1850, 1900];
export function weekCalories(week: number): number {
  return WEEK_CALORIES[Math.min(week, WEEK_CALORIES.length) - 1] ?? WEEK_CALORIES[WEEK_CALORIES.length - 1];
}

export interface SeedExercise {
  name: string;
  sets: number;
  repsOrDurationSec: number;
  recoverySec: number;
  muscles: string;
  steps: string[];
  tip: string;
}

export interface SeedProgram {
  name: string;
  color: string;
  type: FitnessProgramType;
  exercises: SeedExercise[];
}

export const DEFAULT_PROGRAMS: SeedProgram[] = [
  {
    name: "Full Body",
    color: "#C8FF00",
    type: "FULL_BODY",
    exercises: [
      { name: "Squat", sets: 3, repsOrDurationSec: 15, recoverySec: 60, muscles: "Quadriceps, Fessiers", steps: ["Pieds largeur épaules", "Dos droit", "Descends comme pour t'asseoir", "Cuisses parallèles au sol", "Remonte en poussant sur les talons"], tip: "Genoux alignés avec les pieds." },
      { name: "Pompes", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Pectoraux, Triceps", steps: ["Mains largeur épaules", "Corps gainé", "Descends la poitrine vers le sol", "Coudes à 45°", "Pousse pour remonter"], tip: "Garde le corps en ligne droite." },
      { name: "Fentes alternées", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Quadriceps, Fessiers", steps: ["Debout droit", "Grand pas en avant", "Descends le genou arrière", "Genou avant à 90°", "Reviens et alterne"], tip: "Buste droit pendant la descente." },
      { name: "Rowing sous table", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Dos, Biceps", steps: ["Allongé sous une table solide", "Saisis le bord", "Corps gainé", "Tire la poitrine vers la table", "Redescends lentement"], tip: "Serre les omoplates en haut." },
      { name: "Pike Push-up", sets: 3, repsOrDurationSec: 10, recoverySec: 60, muscles: "Épaules", steps: ["Position en V inversé", "Mains au sol", "Descends la tête vers le sol", "Coudes vers l'arrière", "Pousse pour remonter"], tip: "Hanches hautes pour cibler les épaules." },
      { name: "Planche frontale", sets: 3, repsOrDurationSec: 45, recoverySec: 60, muscles: "Abdos, Gainage", steps: ["Appui sur avant-bras", "Corps gainé", "Dos plat", "Contracte les abdos", "Tiens la position"], tip: "Ne creuse pas le bas du dos." },
    ],
  },
  {
    name: "Gainage & Abdos",
    color: "#FF6B35",
    type: "GAINAGE_ABDOS",
    exercises: [
      { name: "Planche frontale", sets: 3, repsOrDurationSec: 45, recoverySec: 45, muscles: "Abdos, Gainage", steps: ["Appui avant-bras", "Corps gainé", "Dos plat", "Contracte les abdos", "Tiens la position"], tip: "Respire régulièrement." },
      { name: "Planche latérale", sets: 3, repsOrDurationSec: 30, recoverySec: 45, muscles: "Obliques", steps: ["Appui sur un avant-bras", "Corps sur le côté", "Hanches hautes", "Aligne épaule-hanche-pied", "Tiens puis change de côté"], tip: "Ne laisse pas les hanches tomber." },
      { name: "Crunch Bicycle", sets: 3, repsOrDurationSec: 20, recoverySec: 45, muscles: "Abdos, Obliques", steps: ["Allongé sur le dos", "Mains derrière la tête", "Pédale dans le vide", "Coude vers genou opposé", "Alterne en rythme"], tip: "Ne tire pas sur la nuque." },
      { name: "Mountain Climbers", sets: 3, repsOrDurationSec: 30, recoverySec: 45, muscles: "Abdos, Cardio", steps: ["Position de pompe", "Corps gainé", "Ramène un genou vers la poitrine", "Alterne rapidement", "Garde le bassin stable"], tip: "Rythme rapide mais contrôlé." },
      { name: "Dead Bug", sets: 3, repsOrDurationSec: 12, recoverySec: 45, muscles: "Abdos profonds", steps: ["Allongé sur le dos", "Bras tendus vers le plafond", "Genoux à 90°", "Descends bras + jambe opposés", "Reviens et alterne"], tip: "Plaque le bas du dos au sol." },
      { name: "Relevés de jambes", sets: 3, repsOrDurationSec: 12, recoverySec: 45, muscles: "Abdos inférieurs", steps: ["Allongé sur le dos", "Jambes tendues", "Mains sous les fessiers", "Lève les jambes à la verticale", "Redescends sans toucher le sol"], tip: "Contrôle la descente." },
    ],
  },
  {
    name: "Jambes & Fessiers",
    color: "#4FC3F7",
    type: "JAMBES_FESSIERS",
    exercises: [
      { name: "Squat bulgare", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Quadriceps, Fessiers", steps: ["Pied arrière surélevé", "Buste droit", "Descends sur la jambe avant", "Genou à 90°", "Remonte en poussant"], tip: "Le poids sur le talon avant." },
      { name: "Hip Thrust", sets: 3, repsOrDurationSec: 15, recoverySec: 60, muscles: "Fessiers", steps: ["Dos appuyé sur un canapé", "Pieds au sol", "Pousse les hanches vers le haut", "Contracte les fessiers en haut", "Redescends lentement"], tip: "Menton rentré, regard vers l'avant." },
      { name: "Fente latérale", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Adducteurs, Fessiers", steps: ["Debout jambes écartées", "Grand pas sur le côté", "Plie une jambe", "Autre jambe tendue", "Reviens et alterne"], tip: "Garde le dos droit." },
      { name: "Soulevé roumain", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Ischios, Fessiers", steps: ["Debout, jambes semi-fléchies", "Penche le buste en avant", "Dos plat", "Descends en gardant les jambes tendues", "Remonte en contractant les fessiers"], tip: "Ne courbe jamais le dos." },
      { name: "Élévations de mollets", sets: 3, repsOrDurationSec: 20, recoverySec: 45, muscles: "Mollets", steps: ["Debout", "Sur la pointe des pieds", "Monte le plus haut possible", "Pause en haut", "Redescends lentement"], tip: "Amplitude complète." },
      { name: "Planche latérale dynamique", sets: 3, repsOrDurationSec: 30, recoverySec: 45, muscles: "Obliques, Fessiers", steps: ["Planche latérale", "Hanche basse vers le sol", "Remonte la hanche", "Mouvement contrôlé", "Change de côté"], tip: "Garde l'alignement du corps." },
    ],
  },
  {
    name: "Haut du Corps",
    color: "#CE93D8",
    type: "HAUT_CORPS",
    exercises: [
      { name: "Pompes larges", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Pectoraux", steps: ["Mains plus larges que les épaules", "Corps gainé", "Descends la poitrine", "Coudes vers l'extérieur", "Pousse pour remonter"], tip: "Contrôle la descente." },
      { name: "Dips aux chaises", sets: 3, repsOrDurationSec: 10, recoverySec: 60, muscles: "Triceps", steps: ["Mains sur deux chaises", "Jambes tendues devant", "Descends en pliant les coudes", "Coudes vers l'arrière", "Remonte en poussant"], tip: "Épaules basses, loin des oreilles." },
      { name: "Curl bouteilles d'eau", sets: 3, repsOrDurationSec: 15, recoverySec: 45, muscles: "Biceps", steps: ["Une bouteille dans chaque main", "Bras le long du corps", "Plie les coudes", "Monte vers les épaules", "Redescends lentement"], tip: "Coudes fixes le long du corps." },
      { name: "Rowing sous table", sets: 3, repsOrDurationSec: 12, recoverySec: 60, muscles: "Dos, Biceps", steps: ["Allongé sous une table", "Saisis le bord", "Corps gainé", "Tire la poitrine vers le haut", "Redescends lentement"], tip: "Serre les omoplates." },
      { name: "Cercles de bras lestés", sets: 3, repsOrDurationSec: 30, recoverySec: 45, muscles: "Épaules", steps: ["Une bouteille dans chaque main", "Bras tendus sur les côtés", "Petits cercles", "Sens horaire puis anti-horaire", "Garde les bras à l'horizontale"], tip: "Mouvement lent et contrôlé." },
      { name: "Superman", sets: 3, repsOrDurationSec: 15, recoverySec: 45, muscles: "Dos, Lombaires", steps: ["Allongé sur le ventre", "Bras tendus devant", "Lève bras et jambes simultanément", "Contracte le dos", "Redescends lentement"], tip: "Regard vers le sol, nuque neutre." },
    ],
  },
];

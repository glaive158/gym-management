export const WALK_KCAL_PER_MIN = 8.5;

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** 1-based program week, clamped to [1, totalWeeks]. */
export function currentWeek(startDate: Date, now: Date, totalWeeks: number): number {
  const diff = now.getTime() - startDate.getTime();
  const week = Math.floor(diff / MS_PER_WEEK) + 1;
  if (week < 1) return 1;
  if (week > totalWeeks) return totalWeeks;
  return week;
}

/** Linear interpolation of target weight at a given week. */
export function weekTargetWeight(startWeight: number, goalWeight: number, week: number, totalWeeks: number): number {
  if (totalWeeks <= 0) return startWeight;
  return startWeight - (startWeight - goalWeight) * (week / totalWeeks);
}

/** Estimated kcal for a walking session of `minutes`, rounded. */
export function walkCalories(minutes: number): number {
  return Math.round(minutes * WALK_KCAL_PER_MIN);
}

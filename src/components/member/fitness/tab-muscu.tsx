"use client";
import type { useFitApp } from "@/hooks/use-fit-app";
export function TabMuscu({ programs, memberId, fit }: { programs: any[]; memberId: string; fit: ReturnType<typeof useFitApp> }) {
  return <div className="p-4">Muscu</div>;
}

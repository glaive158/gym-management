"use client";
import type { useFitApp } from "@/hooks/use-fit-app";
export function TabWeight({ fit }: { fit: ReturnType<typeof useFitApp> }) {
  return <div className="p-4">Weight</div>;
}

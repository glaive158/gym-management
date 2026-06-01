"use client";
import type { useFitApp } from "@/hooks/use-fit-app";
export function TabHome({ fit, onNav }: { fit: ReturnType<typeof useFitApp>; onNav: (t: any) => void }) {
  return <div className="p-4">Home</div>;
}

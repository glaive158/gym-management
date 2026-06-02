import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listPrograms } from "@/lib/server-actions/fitness-program-crud";
import { FitnessTracker } from "@/components/member/fitness-tracker";
import type { ProgramDTO } from "@/components/member/fitness/types";

export const dynamic = "force-dynamic";

export default async function MeFitness() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.userId || ctx.role !== "MEMBER") redirect("/login");
  if (!ctx.tenantId || !ctx.gymId) redirect("/me");

  const r = await listPrograms({ tenantId: ctx.tenantId, gymId: ctx.gymId, memberId: ctx.userId, prisma });
  const raw = r.success ? r.data : [];
  const programs: ProgramDTO[] = raw.map((p) => ({
    id: p.id, name: p.name, color: p.color, type: p.type, createdById: p.createdById,
    exercises: p.exercises.map((e) => ({
      id: e.id, name: e.name, sets: e.sets, repsOrDurationSec: e.repsOrDurationSec,
      recoverySec: e.recoverySec, muscles: e.muscles, steps: e.steps as string[], tip: e.tip, order: e.order,
    })),
  }));

  return <FitnessTracker programs={programs} memberId={ctx.userId} />;
}

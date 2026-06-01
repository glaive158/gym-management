import { redirect, notFound } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { FitnessExerciseEditor } from "@/components/manager/fitness-exercise-editor";
import type { ExerciseDTO } from "@/components/member/fitness/types";

export const dynamic = "force-dynamic";

export default async function EditFitnessProgram({ params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId || ctx.role !== "MANAGER") redirect("/login");
  const program = await prisma.fitnessProgram.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId, gymId: ctx.gymId, createdById: null },
    include: { exercises: { orderBy: { order: "asc" } } },
  });
  if (!program) notFound();

  const exercises: ExerciseDTO[] = program.exercises.map((e) => ({
    id: e.id, name: e.name, sets: e.sets, repsOrDurationSec: e.repsOrDurationSec,
    recoverySec: e.recoverySec, muscles: e.muscles, steps: e.steps as string[], tip: e.tip, order: e.order,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 rounded-full" style={{ background: program.color }} />
        <h1 className="text-2xl font-semibold">{program.name}</h1>
      </div>
      <FitnessExerciseEditor programId={program.id} exercises={exercises} />
    </div>
  );
}

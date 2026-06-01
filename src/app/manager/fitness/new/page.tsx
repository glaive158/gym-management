import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { FitnessProgramForm } from "@/components/manager/fitness-program-form";

export const dynamic = "force-dynamic";

export default async function NewFitnessProgram() {
  const ctx = await getCurrentAuthContext();
  if (ctx?.role !== "MANAGER") redirect("/login");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nouveau programme</h1>
      <FitnessProgramForm />
    </div>
  );
}

import { PlanForm } from "@/components/manager/plan-form";

export default function NewPlanPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Nouvelle formule</h1>
      <PlanForm />
    </div>
  );
}

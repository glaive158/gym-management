import { GymWizard } from "./wizard";

export default function OnboardingPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Ajouter une salle</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configurez votre première salle. La géolocalisation sera utilisée pour vérifier
          les check-ins des membres.
        </p>
      </div>
      <GymWizard />
    </div>
  );
}

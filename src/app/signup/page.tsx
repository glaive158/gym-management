import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Inscrire ma salle</h1>
          <p className="text-sm text-slate-400 mt-1">
            Votre demande sera examinée avant activation.
          </p>
        </div>
        <SignupForm />
      </div>
    </main>
  );
}

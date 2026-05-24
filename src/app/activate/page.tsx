import { Suspense } from "react";
import { ActivateForm } from "./activate-form";

export default function ActivatePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-center">Activer votre compte</h1>
        <Suspense fallback={null}>
          <ActivateForm />
        </Suspense>
      </div>
    </main>
  );
}

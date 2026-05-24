import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">Gym Management SaaS</h1>
        <p className="text-lg text-slate-400">
          Plateforme moderne de gestion de salles de sport. Check-in QR, paiements, multi-salles.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/login"
            className="px-6 py-3 rounded-md bg-blue-600 hover:bg-blue-500 font-medium transition"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 rounded-md border border-slate-700 hover:bg-slate-800 font-medium transition"
          >
            Inscrire ma salle
          </Link>
        </div>
      </div>
    </main>
  );
}

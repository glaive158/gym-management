export const metadata = {
  title: "Supprimer mon compte — Gym Management",
};

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-bold text-slate-100">Supprimer mon compte</h1>

        <section className="space-y-3">
          <p>
            Vous pouvez demander la suppression de votre compte et des données associées à
            tout moment. Deux moyens :
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Via votre salle de sport</strong> : demandez à votre gérant de supprimer
              votre compte depuis son tableau de bord.
            </li>
            <li>
              <strong>Par email</strong> : envoyez votre demande à{" "}
              <a href="mailto:contact@kaytech.sn" className="text-blue-400 underline">
                contact@kaytech.sn
              </a>{" "}
              depuis l&apos;adresse email associée à votre compte. Précisez l&apos;email de
              connexion utilisé.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-100">Données supprimées</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Profil (nom, email, téléphone, photo)</li>
            <li>Identifiants de connexion (mot de passe)</li>
            <li>Position des check-ins</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-100">Données conservées</h2>
          <p>
            Pour des raisons comptables et légales (loi sénégalaise), l&apos;historique des
            paiements, abonnements et check-ins reste anonymisé pendant la durée de
            conservation légale, puis est supprimé.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-100">Délai</h2>
          <p>
            Suppression effective sous 7 jours ouvrés après réception de votre demande.
          </p>
        </section>
      </div>
    </div>
  );
}

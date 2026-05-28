export const metadata = {
  title: "Politique de confidentialité — Gym Management",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-bold text-slate-100">Politique de confidentialité</h1>
        <p className="text-sm text-slate-400">Dernière mise à jour : 28 mai 2026</p>

        <section className="space-y-3">
          <p>
            L&apos;application Gym Management (« l&apos;Application ») est éditée par Kaytech. Cette
            politique explique quelles données nous collectons, pourquoi, et vos droits.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-100">Données collectées</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-300">
            <li><strong>Identité</strong> : nom, email (optionnel), numéro de téléphone.</li>
            <li><strong>Photo de profil</strong> : utilisée pour la validation visuelle à l&apos;entrée (anti-fraude).</li>
            <li><strong>Géolocalisation</strong> : position au moment du check-in, pour vérifier la présence dans la salle. Utilisée uniquement lors du scan, non suivie en arrière-plan.</li>
            <li><strong>Caméra</strong> : lecture du QR code d&apos;entrée. Aucune image n&apos;est stockée.</li>
            <li><strong>Activité</strong> : abonnements, paiements, historique des entrées (check-ins).</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-100">Finalités</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-300">
            <li>Gérer votre abonnement et vos accès à la salle.</li>
            <li>Valider les entrées par QR code et géolocalisation.</li>
            <li>Enregistrer les paiements et l&apos;historique de présence.</li>
            <li>Vous notifier de l&apos;expiration de votre abonnement.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-100">Partage des données</h2>
          <p>
            Vos données ne sont jamais vendues. Elles sont accessibles uniquement à votre salle de
            sport et à l&apos;équipe technique. Chaque organisation est isolée : une salle ne voit
            jamais les données d&apos;une autre.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-100">Conservation</h2>
          <p>
            Les données sont conservées tant que votre compte est actif. La géolocalisation des
            check-ins n&apos;est enregistrée que pour valider l&apos;entrée.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-100">Vos droits</h2>
          <p>
            Vous pouvez demander l&apos;accès, la correction ou la suppression de vos données auprès
            de votre salle ou par email.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-100">Contact</h2>
          <p>Email : <a href="mailto:contact@kaytech.sn" className="text-blue-400 underline">contact@kaytech.sn</a></p>
        </section>
      </div>
    </div>
  );
}

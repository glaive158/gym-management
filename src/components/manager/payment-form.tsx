"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const METHODS = [
  { value: "WAVE", label: "Wave" },
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "PAYDUNYA", label: "PayDunya" },
  { value: "CASH", label: "Espèces" },
  { value: "TPE", label: "TPE (carte)" },
];

const NEEDS_REF = new Set(["WAVE", "ORANGE_MONEY", "PAYDUNYA"]);

export function PaymentForm({
  memberId,
  subscriptions,
}: {
  memberId: string;
  subscriptions: Array<{
    id: string;
    planName: string;
    endDate: string;
    amount: number;
    currency: string;
  }>;
}) {
  const router = useRouter();
  const [subscriptionId, setSubscriptionId] = useState(subscriptions[0]?.id ?? "");
  const [amount, setAmount] = useState(subscriptions[0]?.amount.toString() ?? "");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function onSubChange(id: string) {
    setSubscriptionId(id);
    const sub = subscriptions.find((s) => s.id === id);
    if (sub) setAmount(sub.amount.toString());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/manager/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, subscriptionId, amount: Number(amount), method, reference, notes }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  if (subscriptions.length === 0) {
    return <p className="text-sm text-amber-400">Aucun abonnement actif. Attribuez d&apos;abord un abonnement.</p>;
  }

  if (success) {
    return (
      <div className="text-sm text-green-400 flex items-center gap-2">
        ✓ Paiement enregistré.{" "}
        <button onClick={() => { setSuccess(false); setReference(""); setNotes(""); }} className="underline">
          Enregistrer un autre
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Abonnement</label>
          <select
            value={subscriptionId}
            onChange={(e) => onSubChange(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
          >
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.planName} — jusqu&apos;au {new Date(s.endDate).toLocaleDateString("fr-FR")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Montant (XOF)</label>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Méthode</label>
          <select
            value={method}
            onChange={(e) => { setMethod(e.target.value); setReference(""); }}
            className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        {NEEDS_REF.has(method) && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Référence transaction</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="ex: WAVE-TXN-12345"
              className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Notes (optionnel)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ex: paiement partiel, report…"
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? "..." : "Enregistrer le paiement"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </form>
  );
}

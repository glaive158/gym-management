"use client";

import { useState } from "react";

export function SignupForm() {
  const [form, setForm] = useState({
    organizationName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    city: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur inconnue");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center space-y-3">
        <h2 className="text-xl font-semibold text-green-400">Demande envoyée ✓</h2>
        <p className="text-slate-400 text-sm">
          Votre demande sera examinée par notre équipe. Vous recevrez un email d&apos;activation
          dès validation.
        </p>
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Nom de l&apos;organisation</label>
        <input className={inputCls} required value={form.organizationName} onChange={update("organizationName")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Votre nom</label>
        <input className={inputCls} required value={form.ownerName} onChange={update("ownerName")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Email</label>
        <input className={inputCls} type="email" required value={form.ownerEmail} onChange={update("ownerEmail")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Téléphone</label>
        <input className={inputCls} required value={form.ownerPhone} onChange={update("ownerPhone")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Ville</label>
        <input className={inputCls} required value={form.city} onChange={update("city")} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium"
      >
        {loading ? "Envoi..." : "Envoyer ma demande"}
      </button>
    </form>
  );
}

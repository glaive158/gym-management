"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ActivateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    router.push("/login?activated=1");
  }

  if (!token) {
    return <p className="text-sm text-red-400">Lien d&apos;activation invalide (token manquant).</p>;
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Mot de passe</label>
        <input className={inputCls} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Confirmer le mot de passe</label>
        <input className={inputCls} type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium"
      >
        {loading ? "Activation..." : "Activer mon compte"}
      </button>
    </form>
  );
}

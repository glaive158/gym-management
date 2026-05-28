"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export function PasswordForm() {
  const router = useRouter();
  const { update } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    setDone(true);
    await update(); // refresh mustChangePassword flag in the session
    router.refresh();
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";

  if (done) {
    return (
      <div className="space-y-4">
        <div className="bg-green-950 border border-green-900 rounded p-3 text-green-300 text-sm">
          Mot de passe changé.
        </div>
        <button onClick={() => router.back()}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">
          Retour
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Mot de passe actuel</label>
        <input className={inputCls} type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Nouveau mot de passe</label>
        <input className={inputCls} type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Confirmer le nouveau mot de passe</label>
        <input className={inputCls} type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium">
        {loading ? "..." : "Changer le mot de passe"}
      </button>
    </form>
  );
}

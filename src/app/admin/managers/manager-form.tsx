"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManagerForm({ gyms }: { gyms: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", gymId: gyms[0]?.id ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/admin/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    router.push("/admin/managers");
    router.refresh();
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-lg">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Nom du gérant</label>
        <input className={inputCls} required value={form.name} onChange={update("name")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Email</label>
        <input className={inputCls} type="email" required value={form.email} onChange={update("email")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Téléphone</label>
        <input className={inputCls} required value={form.phone} onChange={update("phone")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Mot de passe</label>
        <input className={inputCls} type="password" required minLength={8} value={form.password} onChange={update("password")} />
        <p className="text-xs text-slate-500 mt-1">8 caractères minimum. Communiquez-le au gérant.</p>
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Salle assignée</label>
        <select className={inputCls} required value={form.gymId} onChange={update("gymId")}>
          {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={loading || gyms.length === 0}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium">
        {loading ? "..." : "Inviter le gérant"}
      </button>
      {gyms.length === 0 && (
        <p className="text-sm text-amber-400">Créez d&apos;abord une salle avant d&apos;inviter un gérant.</p>
      )}
    </form>
  );
}

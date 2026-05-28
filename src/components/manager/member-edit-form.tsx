"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  member: { id: string; name: string; phone: string | null };
}

export function MemberEditForm({ member }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/manager/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-blue-400 hover:text-blue-300">
        Modifier
      </button>
    );
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm";
  return (
    <div className="space-y-2 max-w-sm bg-slate-900 border border-slate-800 rounded p-4">
      <div>
        <label className="block text-xs mb-1 text-slate-400">Nom</label>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs mb-1 text-slate-400">Téléphone</label>
        <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button onClick={save} disabled={busy} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-sm disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sm">Annuler</button>
      </div>
    </div>
  );
}

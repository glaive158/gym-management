"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManualCheckin({ members }: { members: Array<{ id: string; name: string; email: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = members
    .filter((m) => m.name.toLowerCase().includes(q.toLowerCase()) || m.email.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 20);

  async function submit(memberId: string) {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/manager/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    setOpen(false);
    setQ("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium"
      >
        + Check-in manuel
      </button>
    );
  }
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 max-w-md w-full space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Check-in manuel</h3>
          <button onClick={() => setOpen(false)} className="text-slate-400">✕</button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom ou email…"
          className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <ul className="max-h-72 overflow-y-auto divide-y divide-slate-800">
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                disabled={loading}
                onClick={() => submit(m.id)}
                className="w-full text-left px-3 py-2 hover:bg-slate-800 disabled:opacity-50"
              >
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-slate-400">{m.email}</div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-slate-500 text-sm">Aucun résultat</li>
          )}
        </ul>
      </div>
    </div>
  );
}

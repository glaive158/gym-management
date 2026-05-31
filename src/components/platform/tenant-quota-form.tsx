"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TenantQuotaForm({ tenantId, current }: { tenantId: string; current: number }) {
  const router = useRouter();
  const [quota, setQuota] = useState(String(current));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/platform/tenants/${tenantId}/quota`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymQuota: Number(quota) }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        max={1000}
        value={quota}
        onChange={(e) => setQuota(e.target.value)}
        className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
      />
      <button onClick={save} disabled={busy}
        className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium disabled:opacity-50">
        {busy ? "…" : "Mettre à jour"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

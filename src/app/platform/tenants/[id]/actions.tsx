"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TenantStatus } from "@prisma/client";

export function TenantActions({ id, status }: { id: string; status: TenantStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [activationLink, setActivationLink] = useState<string | null>(null);

  async function call(path: string, body?: object) {
    setError(null);
    setLoading(path);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    setLoading(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return null;
    }
    return res.json();
  }

  async function onValidate() {
    const j = await call(`/api/platform/tenants/${id}/validate`);
    if (j?.activationUrl) setActivationLink(j.activationUrl);
    router.refresh();
  }

  async function onReject() {
    if (!reason.trim()) { setError("Raison requise"); return; }
    await call(`/api/platform/tenants/${id}/reject`, { reason });
    setShowRejectForm(false);
    router.refresh();
  }

  async function onSuspend() {
    if (!confirm("Suspendre ce tenant ?")) return;
    await call(`/api/platform/tenants/${id}/suspend`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {activationLink && (
        <div className="text-sm bg-blue-950 border border-blue-900 rounded p-3 text-blue-200 break-all">
          Lien d&apos;activation (envoyé par email) : <span className="font-mono">{activationLink}</span>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {status === TenantStatus.PENDING && (
          <>
            <button onClick={onValidate} disabled={loading !== null}
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50 text-sm font-medium">
              {loading?.includes("validate") ? "..." : "Valider"}
            </button>
            <button onClick={() => setShowRejectForm((v) => !v)}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-sm font-medium">
              Refuser
            </button>
          </>
        )}
        {status === TenantStatus.ACTIVE && (
          <button onClick={onSuspend} disabled={loading !== null}
            className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-sm font-medium">
            Suspendre
          </button>
        )}
      </div>

      {showRejectForm && (
        <div className="space-y-2 bg-slate-900 border border-slate-800 rounded p-3">
          <label className="block text-sm text-slate-300">Raison du refus</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
            className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 text-sm" />
          <button onClick={onReject} disabled={loading !== null}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 text-sm font-medium">
            Confirmer le refus
          </button>
        </div>
      )}
    </div>
  );
}

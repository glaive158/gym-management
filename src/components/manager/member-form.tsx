"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MemberForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Upload échoué");
      return;
    }
    const j = await res.json();
    setAvatar(j.url);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!avatar) { setError("Photo membre obligatoire"); return; }
    setError(null);
    setLoading(true);
    const res = await fetch("/api/manager/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, avatar }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur");
      return;
    }
    const j = await res.json();
    if (j.activationUrl) {
      setActivationUrl(j.activationUrl);
    } else {
      router.push("/manager/members");
      router.refresh();
    }
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";

  if (activationUrl) {
    return (
      <div className="space-y-4">
        <div className="bg-green-950 border border-green-900 rounded p-3 text-green-300 text-sm">
          Membre créé. Lien d&apos;activation (envoyé par email si Resend configuré) :
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3 font-mono text-xs text-slate-300 break-all">
          {activationUrl}
        </div>
        <button onClick={() => { router.push("/manager/members"); router.refresh(); }}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-lg">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Photo du membre (obligatoire)</label>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange}
          className="text-sm text-slate-300" />
        {uploading && <p className="text-xs text-slate-400 mt-1">Téléversement...</p>}
        {avatar && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar} alt="preview" className="w-24 h-24 object-cover rounded" />
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Nom complet</label>
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
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={loading || uploading || !avatar}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium">
        {loading ? "..." : "Créer le membre"}
      </button>
    </form>
  );
}

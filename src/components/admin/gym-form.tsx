"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface GymFormValues {
  name: string;
  address: string;
  city: string;
  phone: string;
  latitude: string;
  longitude: string;
}

export function GymForm({
  initial,
  submitLabel,
  endpoint,
  method,
  redirectTo,
}: {
  initial?: Partial<GymFormValues>;
  submitLabel: string;
  endpoint: string;
  method: "POST" | "PATCH";
  redirectTo: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<GymFormValues>({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    city: initial?.city ?? "",
    phone: initial?.phone ?? "",
    latitude: initial?.latitude ?? "",
    longitude: initial?.longitude ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: keyof GymFormValues) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function useMyLocation() {
    setError(null);
    if (!navigator.geolocation) return setError("Géolocalisation non supportée");
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({
        ...f,
        latitude: pos.coords.latitude.toFixed(6),
        longitude: pos.coords.longitude.toFixed(6),
      })),
      (err) => setError(`GPS refusé : ${err.message}`)
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.error === "QUOTA_REACHED") {
        router.push("/admin/upgrade");
        return;
      }
      setError(j.error ?? "Erreur");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  const inputCls = "w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100";
  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-lg">
      <div>
        <label className="block text-sm mb-1 text-slate-300">Nom</label>
        <input className={inputCls} required value={form.name} onChange={update("name")} />
      </div>
      <div>
        <label className="block text-sm mb-1 text-slate-300">Adresse</label>
        <input className={inputCls} required value={form.address} onChange={update("address")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1 text-slate-300">Ville</label>
          <input className={inputCls} required value={form.city} onChange={update("city")} />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-300">Téléphone</label>
          <input className={inputCls} required value={form.phone} onChange={update("phone")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1 text-slate-300">Latitude</label>
          <input className={inputCls} required type="number" step="any" value={form.latitude} onChange={update("latitude")} />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-300">Longitude</label>
          <input className={inputCls} required type="number" step="any" value={form.longitude} onChange={update("longitude")} />
        </div>
      </div>
      <button type="button" onClick={useMyLocation}
        className="text-sm text-blue-400 hover:text-blue-300">📍 Utiliser ma position</button>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium">
        {loading ? "..." : submitLabel}
      </button>
    </form>
  );
}

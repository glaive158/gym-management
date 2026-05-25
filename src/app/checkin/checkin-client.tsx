"use client";

import { useEffect, useState } from "react";

type Status = "VALID" | "EXPIRED" | "GEO_REJECTED" | "DUPLICATE" | "NO_SUBSCRIPTION";
type ErrorCode = "INVALID_QR" | "WRONG_TENANT" | "BAD_GEO" | "GEO_DENIED" | "NETWORK";

export function CheckinClient({ qrToken }: { qrToken: string }) {
  const [phase, setPhase] = useState<"locating" | "submitting" | "done">("locating");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  async function run() {
    setPhase("locating");
    setError(null);
    setStatus(null);
    if (!navigator.geolocation) { setError("GEO_DENIED"); setPhase("done"); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setPhase("submitting");
        try {
          const res = await fetch("/api/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qrToken, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          });
          const j = await res.json();
          if (j.error) setError(j.error);
          else {
            setStatus(j.status);
            setMemberName(j.memberName ?? null);
            setExpiresAt(j.expiresAt ?? null);
            setDistance(j.distanceMeters ?? null);
          }
        } catch {
          setError("NETWORK");
        }
        setPhase("done");
      },
      () => { setError("GEO_DENIED"); setPhase("done"); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  useEffect(() => { run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (phase === "locating") return <Wrap>📍 Localisation en cours…</Wrap>;
  if (phase === "submitting") return <Wrap>⏳ Vérification…</Wrap>;

  if (error === "GEO_DENIED") return <Wrap kind="warn">Activez la localisation puis réessayez.<br /><Retry onClick={run} /></Wrap>;
  if (error === "NETWORK") return <Wrap kind="warn">Erreur réseau.<br /><Retry onClick={run} /></Wrap>;
  if (error === "INVALID_QR") return <Wrap kind="error">QR invalide. Demandez à l&apos;accueil.</Wrap>;
  if (error === "WRONG_TENANT") return <Wrap kind="error">Ce QR n&apos;est pas pour votre salle.</Wrap>;
  if (error === "BAD_GEO") return <Wrap kind="error">Position invalide.</Wrap>;

  if (status === "VALID") return <Wrap kind="ok">✅ Bienvenue {memberName}.<br />Valide jusqu&apos;au {expiresAt ? new Date(expiresAt).toLocaleDateString("fr-FR") : "—"}.</Wrap>;
  if (status === "DUPLICATE") return <Wrap kind="info">ℹ️ Déjà enregistré aujourd&apos;hui.</Wrap>;
  if (status === "EXPIRED") return <Wrap kind="error">⛔ Abonnement expiré le {expiresAt ? new Date(expiresAt).toLocaleDateString("fr-FR") : "—"}.<br />Contactez le gérant.</Wrap>;
  if (status === "NO_SUBSCRIPTION") return <Wrap kind="error">⛔ Aucun abonnement actif. Contactez le gérant.</Wrap>;
  if (status === "GEO_REJECTED") return <Wrap kind="warn">🚫 Vous êtes à {distance}m. Approchez de l&apos;entrée.<br /><Retry onClick={run} /></Wrap>;

  return null;
}

function Wrap({ children, kind }: { children: React.ReactNode; kind?: "ok" | "warn" | "error" | "info" }) {
  const c =
    kind === "ok" ? "bg-green-950 border-green-800 text-green-100"
    : kind === "warn" ? "bg-amber-950 border-amber-800 text-amber-100"
    : kind === "error" ? "bg-red-950 border-red-800 text-red-100"
    : kind === "info" ? "bg-blue-950 border-blue-800 text-blue-100"
    : "bg-slate-900 border-slate-800 text-slate-100";
  return <div className={`max-w-md mx-auto mt-12 p-6 rounded-lg border text-center text-lg ${c}`}>{children}</div>;
}

function Retry({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="mt-3 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-base">Réessayer</button>;
}

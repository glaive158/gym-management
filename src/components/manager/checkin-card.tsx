/* eslint-disable @next/next/no-img-element */

const STATUS_STYLE: Record<string, string> = {
  VALID: "bg-green-950 border-green-800 text-green-100",
  EXPIRED: "bg-red-950 border-red-800 text-red-100",
  DUPLICATE: "bg-blue-950 border-blue-800 text-blue-100",
  NO_SUBSCRIPTION: "bg-red-950 border-red-800 text-red-100",
  GEO_REJECTED: "bg-amber-950 border-amber-800 text-amber-100",
};

const LABEL: Record<string, string> = {
  VALID: "À jour",
  EXPIRED: "Expiré",
  DUPLICATE: "Doublon",
  NO_SUBSCRIPTION: "Pas d'abonnement",
  GEO_REJECTED: "Hors zone",
};

export function CheckinCard({
  avatar,
  name,
  status,
  time,
  source,
}: {
  avatar: string | null;
  name: string;
  status: string;
  time: string;
  source: string;
}) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border ${
        STATUS_STYLE[status] ?? "bg-slate-900 border-slate-800"
      }`}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="w-16 h-16 rounded-full object-cover" />
      ) : (
        <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-xl">
          {name[0]}
        </div>
      )}
      <div className="flex-1">
        <div className="font-semibold text-lg">{name}</div>
        <div className="text-xs opacity-75">
          {LABEL[status] ?? status} · {source} · {new Date(time).toLocaleTimeString("fr-FR")}
        </div>
      </div>
    </div>
  );
}

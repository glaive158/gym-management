import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listManagers } from "@/lib/server-actions/manager-crud";
import { listGyms } from "@/lib/server-actions/gym-crud";

export const dynamic = "force-dynamic";

export default async function ManagersList() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");

  const [managers, gyms] = await Promise.all([
    listManagers({ tenantId: ctx.tenantId, prisma }),
    listGyms({ tenantId: ctx.tenantId, prisma }),
  ]);
  const gymById = new Map(gyms.map(g => [g.id, g.name]));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Gérants ({managers.length})</h1>
        <Link href="/admin/managers/new"
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">+ Inviter</Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Salle</th>
              <th className="px-4 py-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {managers.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Aucun gérant</td></tr>
            )}
            {managers.map((m) => (
              <tr key={m.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3 text-slate-100">{m.name}</td>
                <td className="px-4 py-3 text-slate-400">{m.email}</td>
                <td className="px-4 py-3 text-slate-400">{m.gymId ? gymById.get(m.gymId) ?? "—" : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded border ${
                    m.status === "ACTIVE" ? "bg-green-950 text-green-300 border-green-900" :
                    m.status === "PENDING" ? "bg-amber-950 text-amber-300 border-amber-900" :
                    "bg-red-950 text-red-300 border-red-900"
                  }`}>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

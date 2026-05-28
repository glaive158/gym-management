import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listMembers } from "@/lib/server-actions/member-crud";
import { MemberRowActions } from "@/components/manager/member-row-actions";

export const dynamic = "force-dynamic";

export default async function MembersList({ searchParams }: { searchParams: { q?: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId) redirect("/login");
  const search = searchParams.q ?? "";
  const members = await listMembers({ tenantId: ctx.tenantId, search, prisma });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Membres ({members.length})</h1>
        <Link href="/manager/members/new"
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">+ Ajouter</Link>
      </div>

      <form className="flex gap-2">
        <input name="q" defaultValue={search} placeholder="Rechercher nom, email, téléphone…"
          className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm" />
        <button className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm">Rechercher</button>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left">Photo</th>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Téléphone</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucun membre</td></tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="border-b border-slate-800 last:border-0">
                <td className="px-4 py-3">
                  {m.avatar
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={m.avatar} alt={m.name} className="w-10 h-10 object-cover rounded" />
                    : <div className="w-10 h-10 bg-slate-800 rounded" />}
                </td>
                <td className="px-4 py-3 text-slate-100">{m.name}</td>
                <td className="px-4 py-3 text-slate-400">{m.email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{m.phone}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-4 justify-end">
                    <Link href={`/manager/members/${m.id}`} className="text-blue-400 hover:text-blue-300">Voir →</Link>
                    <MemberRowActions member={{ id: m.id, name: m.name }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

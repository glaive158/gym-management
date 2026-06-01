import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { listPrograms } from "@/lib/server-actions/fitness-program-crud";

export const dynamic = "force-dynamic";

export default async function ManagerFitness() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.tenantId || !ctx.gymId || ctx.role !== "MANAGER") redirect("/login");
  const r = await listPrograms({ tenantId: ctx.tenantId, gymId: ctx.gymId, prisma });
  const programs = r.success ? r.data : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Programmes fitness ({programs.length})</h1>
        <Link href="/manager/fitness/new" className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">+ Nouveau</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {programs.map((p) => (
          <Link key={p.id} href={`/manager/fitness/${p.id}`}
            className="block bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-lg p-4 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
              <span className="font-medium">{p.name}</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">{p.exercises.length} exercices</p>
          </Link>
        ))}
        {programs.length === 0 && <p className="text-slate-500 text-sm">Aucun programme. Crée le premier.</p>}
      </div>
    </div>
  );
}

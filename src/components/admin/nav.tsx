import Link from "next/link";
import { SignOutButton } from "@/components/platform/sign-out-button";

export function AdminNav() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/admin" className="font-semibold text-slate-100">Admin</Link>
        <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-200">Dashboard</Link>
        <Link href="/admin/gyms" className="text-sm text-slate-400 hover:text-slate-200">Salles</Link>
        <Link href="/admin/managers" className="text-sm text-slate-400 hover:text-slate-200">Gérants</Link>
        <Link href="/admin/billing" className="text-sm text-slate-400 hover:text-slate-200">Facturation</Link>
        <Link href="/admin/reports" className="text-sm text-slate-400 hover:text-slate-200">Rapports</Link>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/account/password" className="text-sm text-slate-400 hover:text-slate-200">Mot de passe</Link>
        <SignOutButton />
      </div>
    </nav>
  );
}

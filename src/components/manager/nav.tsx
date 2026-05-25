import Link from "next/link";
import { SignOutButton } from "@/components/platform/sign-out-button";

export function ManagerNav() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/manager" className="font-semibold text-slate-100">Manager</Link>
        <Link href="/manager" className="text-sm text-slate-400 hover:text-slate-200">Dashboard</Link>
        <Link href="/manager/members" className="text-sm text-slate-400 hover:text-slate-200">Membres</Link>
        <Link href="/manager/plans" className="text-sm text-slate-400 hover:text-slate-200">Formules</Link>
        <Link href="/manager/payments" className="text-sm text-slate-400 hover:text-slate-200">Paiements</Link>
        <Link href="/manager/checkin-live" className="text-sm text-slate-400 hover:text-slate-200">Check-ins live</Link>
        <Link href="/manager/reports" className="text-sm text-slate-400 hover:text-slate-200">Rapports</Link>
      </div>
      <SignOutButton />
    </nav>
  );
}

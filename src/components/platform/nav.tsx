import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export function PlatformNav() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/platform" className="font-semibold text-slate-100">Platform</Link>
        <Link href="/platform" className="text-sm text-slate-400 hover:text-slate-200">Dashboard</Link>
        <Link href="/platform/tenants" className="text-sm text-slate-400 hover:text-slate-200">Tenants</Link>
        <Link href="/platform/invoices" className="text-sm text-slate-400 hover:text-slate-200">Factures</Link>
      </div>
      <SignOutButton />
    </nav>
  );
}

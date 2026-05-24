import Link from "next/link";
import { SignOutButton } from "@/components/platform/sign-out-button";

export function AdminNav() {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/admin" className="font-semibold text-slate-100">Admin</Link>
        <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-200">Dashboard</Link>
      </div>
      <SignOutButton />
    </nav>
  );
}

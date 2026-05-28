import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function AccountPasswordPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="max-w-md mx-auto py-10 px-4 space-y-6">
      <h1 className="text-2xl font-semibold">Changer le mot de passe</h1>
      {session.user.mustChangePassword && (
        <div className="bg-amber-950/40 border border-amber-900 rounded p-3 text-amber-300 text-sm">
          Pour votre sécurité, changez le mot de passe qui vous a été communiqué.
        </div>
      )}
      <PasswordForm />
    </div>
  );
}

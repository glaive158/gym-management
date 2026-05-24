import { MemberForm } from "@/components/manager/member-form";

export default function NewMemberPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Nouveau membre</h1>
      <MemberForm />
    </div>
  );
}

import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listRecentCheckIns } from "@/lib/server-actions/checkin";
import { LiveFeed } from "./live-feed";
import { ManualCheckin } from "@/components/manager/manual-checkin";

export const dynamic = "force-dynamic";

export default async function CheckinLivePage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.gymId) redirect("/login");

  const [recent, members] = await Promise.all([
    listRecentCheckIns({ gymId: ctx.gymId, limit: 50, prisma }),
    prisma.user.findMany({
      where: { gymId: ctx.gymId, role: Role.MEMBER, status: "ACTIVE" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const initial = recent.map((r) => ({
    id: r.id,
    status: r.status,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
    member: { name: r.member.name, avatar: r.member.avatar },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Check-ins en direct</h1>
        <ManualCheckin members={members.map((m) => ({ id: m.id, name: m.name, email: m.email ?? "" }))} />
      </div>
      <LiveFeed gymId={ctx.gymId} initial={initial} />
    </div>
  );
}

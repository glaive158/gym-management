import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.gymId || !ctx.tenantId) return new Response("Forbidden", { status: 403 });
  const checks = await prisma.checkIn.findMany({
    where: { tenantId: ctx.tenantId, gymId: ctx.gymId },
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: { member: true },
  });
  const rows = checks.map((c) => ({
    createdAt: c.createdAt,
    memberName: c.member.name,
    status: c.status,
    source: c.source,
  }));
  const csv = toCsv(rows, ["createdAt", "memberName", "status", "source"]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="checkins-${ctx.gymId}.csv"`,
    },
  });
}

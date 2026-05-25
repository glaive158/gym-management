import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.MANAGER || !ctx.gymId || !ctx.tenantId) return new Response("Forbidden", { status: 403 });
  const payments = await prisma.payment.findMany({
    where: { tenantId: ctx.tenantId, gymId: ctx.gymId },
    orderBy: { paidAt: "desc" },
    include: { member: true },
  });
  const rows = payments.map((p) => ({
    paidAt: p.paidAt,
    memberName: p.member.name,
    memberEmail: p.member.email,
    method: p.method,
    amountXof: p.amount,
    reference: p.reference ?? "",
  }));
  const csv = toCsv(rows, ["paidAt", "memberName", "memberEmail", "method", "amountXof", "reference"]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="paiements-${ctx.gymId}.csv"`,
    },
  });
}

import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTenantReport } from "@/lib/server-actions/reports";
import { toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const now = new Date();
  const year = Number(url.searchParams.get("year") ?? now.getFullYear());
  const month = Number(url.searchParams.get("month") ?? now.getMonth() + 1);
  const report = await getTenantReport({ tenantId: ctx.tenantId, year, month, prisma });
  const csv = toCsv(report.byGym, ["gymName", "revenueXof", "paymentsCount", "checkInsCount", "membersCount"]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapport-${year}-${String(month).padStart(2, "0")}.csv"`,
    },
  });
}

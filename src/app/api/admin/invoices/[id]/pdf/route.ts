import { getCurrentAuthContext } from "@/lib/auth-context";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildInvoicePdf } from "@/lib/pdf-invoice";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || ctx.role !== Role.TENANT_ADMIN || !ctx.tenantId) return new Response("Forbidden", { status: 403 });
  const inv = await prisma.tenantInvoice.findUnique({ where: { id: params.id }, include: { tenant: true } });
  if (!inv || inv.tenantId !== ctx.tenantId) return new Response("Not found", { status: 404 });
  const buf = await buildInvoicePdf(inv);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${inv.id}.pdf"`,
    },
  });
}

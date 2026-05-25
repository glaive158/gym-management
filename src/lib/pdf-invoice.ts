import PDFDocument from "pdfkit";
import type { TenantInvoice, Tenant } from "@prisma/client";

export async function buildInvoicePdf(inv: TenantInvoice & { tenant: Tenant }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(20).text("FACTURE", { align: "right" });
      doc.fontSize(10).fillColor("#555").text(`#${inv.id}`, { align: "right" });
      doc.moveDown();

      doc.fillColor("#000").fontSize(11).text("Gym Management SaaS");
      doc.fontSize(9).fillColor("#555").text("Plateforme SaaS · Sénégal");
      doc.moveDown();

      doc.fillColor("#000").fontSize(11).text("Facturé à :");
      doc.text(inv.tenant.name);
      doc.fontSize(9).fillColor("#555").text(inv.tenant.ownerEmail);
      doc.text(inv.tenant.city);
      doc.moveDown();

      const fmt = (d: Date) => d.toLocaleDateString("fr-FR");
      doc.fillColor("#000").fontSize(10).text(`Période : ${fmt(inv.periodStart)} → ${fmt(inv.periodEnd)}`);
      doc.text(`Échéance : ${fmt(inv.dueDate)}`);
      doc.text(`Statut : ${inv.status}`);
      doc.moveDown();

      doc.fontSize(11).text("Détail", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Abonnement plateforme — ${inv.nbGyms} salle${inv.nbGyms > 1 ? "s" : ""}`);
      doc.text(`Prix unitaire : ${inv.unitPriceXof.toLocaleString("fr-FR")} XOF`);
      doc.moveDown();
      doc.fontSize(13).text(`TOTAL : ${inv.totalXof.toLocaleString("fr-FR")} XOF`, { align: "right" });

      doc.moveDown(2);
      doc.fontSize(8).fillColor("#999").text("Paiement par Wave, Orange Money, PayDunya ou virement bancaire.", { align: "center" });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

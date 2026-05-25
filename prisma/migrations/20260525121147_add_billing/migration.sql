-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TenantPaymentMethod" AS ENUM ('WAVE', 'ORANGE_MONEY', 'PAYDUNYA', 'MANUAL_TRANSFER');

-- CreateTable
CREATE TABLE "TenantInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "nbGyms" INTEGER NOT NULL,
    "unitPriceXof" INTEGER NOT NULL,
    "totalXof" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountXof" INTEGER NOT NULL,
    "method" "TenantPaymentMethod" NOT NULL,
    "externalRef" TEXT,
    "recordedById" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantInvoice_status_dueDate_idx" ON "TenantInvoice"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "TenantInvoice_tenantId_periodStart_key" ON "TenantInvoice"("tenantId", "periodStart");

-- CreateIndex
CREATE INDEX "TenantPayment_tenantId_idx" ON "TenantPayment"("tenantId");

-- CreateIndex
CREATE INDEX "TenantPayment_invoiceId_idx" ON "TenantPayment"("invoiceId");

-- AddForeignKey
ALTER TABLE "TenantInvoice" ADD CONSTRAINT "TenantInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPayment" ADD CONSTRAINT "TenantPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPayment" ADD CONSTRAINT "TenantPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "TenantInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPayment" ADD CONSTRAINT "TenantPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EXPIRATION_J7', 'EXPIRATION_J3', 'EXPIRATION_J0');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationLog_tenantId_idx" ON "NotificationLog"("tenantId");

-- CreateIndex
CREATE INDEX "NotificationLog_memberId_idx" ON "NotificationLog"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_subscriptionId_type_channel_key" ON "NotificationLog"("subscriptionId", "type", "channel");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;


import { PrismaClient } from "@prisma/client";

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) throw new Error("DATABASE_URL_TEST not set");

export const testPrisma = new PrismaClient({ datasources: { db: { url: testUrl } } });

export async function resetDb(): Promise<void> {
  await testPrisma.paymentIntent.deleteMany();
  await testPrisma.notificationLog.deleteMany();
  await testPrisma.tenantPayment.deleteMany();
  await testPrisma.tenantInvoice.deleteMany();
  await testPrisma.checkIn.deleteMany();
  await testPrisma.payment.deleteMany();
  await testPrisma.subscription.deleteMany();
  await testPrisma.plan.deleteMany();
  await testPrisma.user.deleteMany();
  await testPrisma.gym.deleteMany();
  await testPrisma.tenant.deleteMany();
}

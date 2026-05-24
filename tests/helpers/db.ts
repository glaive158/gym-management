import { PrismaClient } from "@prisma/client";

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) throw new Error("DATABASE_URL_TEST not set");

export const testPrisma = new PrismaClient({ datasources: { db: { url: testUrl } } });

export async function resetDb(): Promise<void> {
  await testPrisma.user.deleteMany();
  await testPrisma.gym.deleteMany();
  await testPrisma.tenant.deleteMany();
}

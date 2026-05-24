import { PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "owner@platform.local";
  const password = "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`PLATFORM_OWNER already exists: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      name: "Platform Owner",
      email,
      passwordHash,
      role: Role.PLATFORM_OWNER,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`Created PLATFORM_OWNER:`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`Change the password after first login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

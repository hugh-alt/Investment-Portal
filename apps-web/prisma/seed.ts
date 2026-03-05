import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Role } from "../src/generated/prisma/enums";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CLIENT_NAMES = [
  "Alice Johnson",
  "Bob Williams",
  "Carol Davis",
  "David Martinez",
  "Emily Chen",
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "mcchugh@gmail.com" },
    update: {},
    create: {
      email: "mcchugh@gmail.com",
      name: "Hugh McCaffery",
      role: Role.ADMIN,
    },
  });

  const adviser = await prisma.adviser.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      firmName: "Demo Advice Co",
    },
  });

  for (const name of CLIENT_NAMES) {
    await prisma.client.upsert({
      where: { id: `seed-${name.toLowerCase().replace(/\s/g, "-")}` },
      update: {},
      create: {
        id: `seed-${name.toLowerCase().replace(/\s/g, "-")}`,
        adviserId: adviser.id,
        name,
      },
    });
  }

  console.log("Seeded: 1 admin user, 1 adviser, 5 clients");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

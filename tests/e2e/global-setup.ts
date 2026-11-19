import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseURL } from "./isolate-db";

export default async function globalSetup() {
  const connectionString = resolveDatabaseURL();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ["error"],
  });
  try {
    await prisma.signal.deleteMany();
    await prisma.presence.deleteMany();
  } finally {
    await prisma.$disconnect();
  }
}

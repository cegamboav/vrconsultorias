import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {

  console.log("Ejecutando seed...");

  const password = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: {
      email: "admin@crmreferidos.local",
    },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@crmreferidos.local",
      password,
      role: "ADMIN",
      isActive: true,
    },
  });


  const services = [
    {
      name: "Inversiones",
      slug: "inversiones",
      color: "#2563eb",
    },
    {
      name: "Charlas",
      slug: "charlas",
      color: "#16a34a",
    },
    {
      name: "Contabilidad",
      slug: "contabilidad",
      color: "#9333ea",
    },
  ];


  for (const service of services) {
    await prisma.serviceCategory.upsert({
      where: {
        slug: service.slug,
      },
      update: {
        name: service.name,
        color: service.color,
        isActive: true,
      },
      create: {
        ...service,
        isActive: true,
      },
    });
  }


  console.log("Seed completado correctamente");
}


main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
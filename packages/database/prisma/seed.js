import { PrismaClient, ActivityType, LeadSource, LeadStatus, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const DEFAULT_SERVICE_CATEGORIES = [
  { id: "svc_inversiones", name: "Inversiones", slug: "inversiones", color: "#6B9BD1" },
  { id: "svc_charlas", name: "Charlas", slug: "charlas", color: "#9B7ED4" },
  { id: "svc_contabilidad", name: "Contabilidad", slug: "contabilidad", color: "#5DAA8A" }
];

async function seedServiceCategories() {
  for (const cat of DEFAULT_SERVICE_CATEGORIES) {
    await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, color: cat.color, isActive: true },
      create: { ...cat, isActive: true }
    });
  }
  return prisma.serviceCategory.findFirst({ where: { slug: "inversiones" } });
}

async function main() {
  await seedServiceCategories();
  const defaultService = await prisma.serviceCategory.findFirst({
    where: { slug: "inversiones" }
  });

  const adminPasswordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@crmreferidos.local" },
    update: {
      name: "Admin CRM",
      password: adminPasswordHash,
      role: Role.ADMIN
    },
    create: {
      name: "Admin CRM",
      email: "admin@crmreferidos.local",
      password: adminPasswordHash,
      role: Role.ADMIN
    }
  });

  const existingLead = await prisma.lead.findFirst({
    where: { phone: "50670000000" }
  });

  if (!existingLead && defaultService) {
    const lead = await prisma.lead.create({
      data: {
        fullName: "Juan Perez",
        phone: "50670000000",
        email: "juan@example.com",
        source: LeadSource.REFERIDO,
        serviceCategoryId: defaultService.id,
        status: LeadStatus.NEW,
        ownerId: admin.id,
        activities: {
          create: [
            {
              userId: admin.id,
              type: ActivityType.LEAD_CREATED,
              description: "Lead creado manualmente"
            },
            {
              userId: admin.id,
              type: ActivityType.NOTE_ADDED,
              description: "Interesado en inversion de corto plazo",
              metadata: {
                channel: "manual"
              }
            }
          ]
        }
      }
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastActivityAt: new Date() }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

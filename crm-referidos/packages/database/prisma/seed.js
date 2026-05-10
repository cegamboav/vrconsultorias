import { PrismaClient, ActivityType, LeadSource, LeadStatus, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
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

  if (!existingLead) {
    const lead = await prisma.lead.create({
      data: {
        fullName: "Juan Perez",
        phone: "50670000000",
        email: "juan@example.com",
        source: LeadSource.REFERRAL,
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

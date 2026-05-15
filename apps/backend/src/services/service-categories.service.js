import { prisma } from "@crm/database";

/** Listado público para formularios (solo categorías activas). */
export async function listActiveServiceCategories() {
  return prisma.serviceCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      isActive: true
    }
  });
}

/** Listado administrativo (futuro: CRUD de servicios). */
export async function listAllServiceCategories() {
  return prisma.serviceCategory.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { leads: true } }
    }
  });
}

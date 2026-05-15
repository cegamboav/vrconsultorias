import { prisma } from "@crm/database";
import { AppError } from "../utils/app-error.js";
import { AuditAction, logAudit } from "./audit.service.js";

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  color: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};

const CATEGORY_SELECT_WITH_COUNT = {
  ...CATEGORY_SELECT,
  _count: { select: { leads: true } }
};

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function assertValidColor(color) {
  const raw = String(color ?? "").trim();
  if (!HEX_COLOR.test(raw)) {
    throw new AppError("El color debe ser un hex válido (ej. #6B9BD1).", 400);
  }
  return raw;
}

function slugify(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(base) {
  const root = base || "servicio";
  let slug = root;
  let suffix = 0;
  while (await prisma.serviceCategory.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${root}-${suffix}`;
  }
  return slug;
}

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

/** Listado para Configuración (activas e inactivas). */
export async function listAllServiceCategories() {
  return prisma.serviceCategory.findMany({
    orderBy: { name: "asc" },
    select: CATEGORY_SELECT_WITH_COUNT
  });
}

export async function createServiceCategory({ actorId, payload }) {
  const name = String(payload?.name ?? "").trim();
  const color = assertValidColor(payload?.color);

  if (!name) throw new AppError("El nombre del servicio es obligatorio.", 400);

  const slug = await uniqueSlug(slugify(name) || "servicio");

  const created = await prisma.serviceCategory.create({
    data: { name, slug, color, isActive: true },
    select: CATEGORY_SELECT_WITH_COUNT
  });

  await logAudit({
    actorId,
    action: AuditAction.SERVICE_CREATED,
    description: `Servicio ${created.name} fue creado.`,
    metadata: { serviceCategoryId: created.id, slug: created.slug }
  });

  return created;
}

export async function updateServiceCategory({ actorId, categoryId, payload }) {
  const existing = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
  if (!existing) throw new AppError("Servicio no encontrado.", 404);

  const data = {};

  if (payload?.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) throw new AppError("El nombre no puede estar vacío.", 400);
    data.name = name;
  }

  if (payload?.color !== undefined) {
    data.color = assertValidColor(payload.color);
  }

  if (Object.keys(data).length === 0) {
    return prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      select: CATEGORY_SELECT_WITH_COUNT
    });
  }

  const updated = await prisma.serviceCategory.update({
    where: { id: categoryId },
    data,
    select: CATEGORY_SELECT_WITH_COUNT
  });

  await logAudit({
    actorId,
    action: AuditAction.SERVICE_UPDATED,
    description: `Servicio ${updated.name} fue actualizado.`,
    metadata: { serviceCategoryId: updated.id, fields: Object.keys(data) }
  });

  return updated;
}

export async function setServiceCategoryActive({ actorId, categoryId, isActive }) {
  const existing = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
  if (!existing) throw new AppError("Servicio no encontrado.", 404);

  const nextActive = Boolean(isActive);
  if (nextActive === existing.isActive) {
    return prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      select: CATEGORY_SELECT_WITH_COUNT
    });
  }

  const updated = await prisma.serviceCategory.update({
    where: { id: categoryId },
    data: { isActive: nextActive },
    select: CATEGORY_SELECT_WITH_COUNT
  });

  const action = nextActive ? AuditAction.SERVICE_ACTIVATED : AuditAction.SERVICE_DEACTIVATED;
  const verb = nextActive ? "fue activado" : "fue desactivado";

  await logAudit({
    actorId,
    action,
    description: `Servicio ${updated.name} ${verb}.`,
    metadata: { serviceCategoryId: updated.id }
  });

  return updated;
}

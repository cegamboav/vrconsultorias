import bcrypt from "bcrypt";
import { prisma, Role } from "@crm/database";
import { AppError } from "../utils/app-error.js";
import { AuditAction, logAudit } from "./audit.service.js";

const BCRYPT_ROUNDS = 10;

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  calendly: true,
  createdAt: true,
  updatedAt: true
};

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeRole(value) {
  if (!value) return Role.USER;
  const key = String(value).trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(Role, key)) {
    throw new AppError("Rol no válido.", 400);
  }
  return Role[key];
}

function assertStrongEnoughPassword(password) {
  const raw = String(password ?? "");
  if (raw.length < 8) {
    throw new AppError("La contraseña debe tener al menos 8 caracteres.", 400);
  }
}

/**
 * Garantiza que SIEMPRE quede al menos un administrador activo en el sistema.
 *
 * Evalúa el cambio propuesto sobre `targetUser` y, si después de aplicarlo el
 * conjunto "ADMIN activo" quedaría vacío, lanza AppError 400 con copy claro.
 *
 * Lógica:
 *   - Si el target NO era ADMIN activo, el cambio no puede romper la invariante.
 *   - Si después del cambio el target SIGUE siendo ADMIN activo, tampoco.
 *   - Solo cuenta cuando el cambio le quita al target el bit (ADMIN ∧ activo).
 *
 * @param {{ id: string, role: string, isActive: boolean }} targetUser
 * @param {{ willBeAdmin: boolean, willBeActive: boolean, reason: "deactivate"|"role" }} change
 */
async function assertKeepsAtLeastOneActiveAdmin(targetUser, change) {
  const wasAdminActive = targetUser.role === Role.ADMIN && targetUser.isActive === true;
  const stillAdminActive = change.willBeAdmin && change.willBeActive;
  if (!wasAdminActive || stillAdminActive) return;

  const remaining = await prisma.user.count({
    where: {
      id: { not: targetUser.id },
      role: Role.ADMIN,
      isActive: true
    }
  });

  if (remaining === 0) {
    const message =
      change.reason === "role"
        ? "No es posible quitar el rol de administrador al último administrador activo del sistema."
        : "No es posible desactivar el último administrador activo del sistema.";
    throw new AppError(message, 400);
  }
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: PUBLIC_USER_SELECT
  });
}

export async function createUser({ payload, actorId }) {
  const name = String(payload?.name ?? "").trim();
  const email = normalizeEmail(payload?.email);
  const phone = payload?.phone ? String(payload.phone).trim() : null;
  const role = normalizeRole(payload?.role);
  const password = payload?.password;

  if (!name) throw new AppError("El nombre es obligatorio.", 400);
  if (!email) throw new AppError("El correo es obligatorio.", 400);
  if (!password) throw new AppError("La contraseña inicial es obligatoria.", 400);
  assertStrongEnoughPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("Ya existe un usuario con ese correo.", 409);
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const created = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      role,
      password: hash,
      isActive: true
    },
    select: PUBLIC_USER_SELECT
  });

  if (actorId) {
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { name: true }
    });
    const actorLabel = actor?.name ?? "Administrador";
    await logAudit({
      actorId,
      action: AuditAction.USER_CREATED,
      description: `${actorLabel} creó usuario ${created.name}.`,
      metadata: { targetUserId: created.id, email: created.email, role: created.role }
    });
  }

  return created;
}

export async function updateUser({ targetId, actorId, payload }) {
  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw new AppError("Usuario no encontrado.", 404);

  const data = {};

  if (payload?.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) throw new AppError("El nombre no puede estar vacío.", 400);
    data.name = name;
  }
  if (payload?.phone !== undefined) {
    data.phone = payload.phone ? String(payload.phone).trim() : null;
  }
  if (payload?.role !== undefined) {
    const nextRole = normalizeRole(payload.role);
    // Salvaguarda mínima: no permitir que un admin se quite el rol a sí mismo
    // (evita quedarse sin acceso administrativo accidentalmente).
    if (targetId === actorId && user.role === Role.ADMIN && nextRole !== Role.ADMIN) {
      throw new AppError("No puedes quitarte el rol de ADMIN a ti mismo.", 400);
    }
    // Invariante global: siempre debe existir ≥1 administrador activo.
    if (nextRole !== user.role) {
      await assertKeepsAtLeastOneActiveAdmin(user, {
        willBeAdmin: nextRole === Role.ADMIN,
        willBeActive: user.isActive,
        reason: "role"
      });
    }
    data.role = nextRole;
  }
  if (payload?.calendly !== undefined) {
    data.calendly = payload.calendly ? String(payload.calendly).trim() : null;
  }

  if (Object.keys(data).length === 0) {
    return prisma.user.findUnique({ where: { id: targetId }, select: PUBLIC_USER_SELECT });
  }

  return prisma.user.update({
    where: { id: targetId },
    data,
    select: PUBLIC_USER_SELECT
  });
}

export async function setUserActive({ targetId, actorId, isActive }) {
  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw new AppError("Usuario no encontrado.", 404);

  const nextActive = Boolean(isActive);

  if (targetId === actorId && nextActive === false) {
    throw new AppError("No puedes desactivarte a ti mismo.", 400);
  }

  // Invariante global: siempre debe existir ≥1 administrador activo.
  if (nextActive !== user.isActive) {
    await assertKeepsAtLeastOneActiveAdmin(user, {
      willBeAdmin: user.role === Role.ADMIN,
      willBeActive: nextActive,
      reason: "deactivate"
    });
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { isActive: nextActive },
    select: PUBLIC_USER_SELECT
  });

  if (actorId && nextActive !== user.isActive) {
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { name: true }
    });
    const actorLabel = actor?.name ?? "Administrador";
    const action = nextActive ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED;
    const verb = nextActive ? "activó" : "desactivó";
    await logAudit({
      actorId,
      action,
      description: `${actorLabel} ${verb} usuario ${updated.name}.`,
      metadata: { targetUserId: updated.id }
    });
  }

  return updated;
}

export async function resetUserPassword({ targetId, newPassword, actorId }) {
  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw new AppError("Usuario no encontrado.", 404);

  assertStrongEnoughPassword(newPassword);
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: targetId },
    data: { password: hash }
  });

  if (actorId) {
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { name: true }
    });
    const actorLabel = actor?.name ?? "Administrador";
    await logAudit({
      actorId,
      action: AuditAction.USER_PASSWORD_RESET,
      description: `${actorLabel} restableció contraseña de ${user.name}.`,
      metadata: { targetUserId: user.id }
    });
  }

  return { ok: true };
}

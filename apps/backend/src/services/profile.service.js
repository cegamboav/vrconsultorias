import bcrypt from "bcrypt";
import { prisma } from "@crm/database";
import { AppError } from "../utils/app-error.js";
import { AuditAction, logAudit } from "./audit.service.js";

const BCRYPT_ROUNDS = 10;

const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function assertStrongEnoughPassword(password) {
  const raw = String(password ?? "");
  if (raw.length < 8) {
    throw new AppError("La contraseña debe tener al menos 8 caracteres.", 400);
  }
}

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PROFILE_SELECT
  });
  if (!user) throw new AppError("Usuario no encontrado.", 404);
  return user;
}

export async function updateProfile({ userId, payload }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
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

  if (payload?.email !== undefined) {
    const email = normalizeEmail(payload.email);
    if (!email) throw new AppError("El correo es obligatorio.", 400);
    if (email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new AppError("Ya existe un usuario con ese correo.", 409);
      }
      data.email = email;
    }
  }

  if (Object.keys(data).length === 0) {
    return prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: PROFILE_SELECT
  });

  await logAudit({
    actorId: userId,
    action: AuditAction.PROFILE_UPDATED,
    description: `${updated.name} actualizó su perfil.`,
    metadata: { fields: Object.keys(data) }
  });

  return updated;
}

export async function changeOwnPassword({ userId, currentPassword, newPassword, confirmPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("Usuario no encontrado.", 404);

  const current = String(currentPassword ?? "");
  const next = String(newPassword ?? "");
  const confirm = String(confirmPassword ?? "");

  if (!current) throw new AppError("La contraseña actual es obligatoria.", 400);
  if (!next) throw new AppError("La nueva contraseña es obligatoria.", 400);
  if (next !== confirm) {
    throw new AppError("La confirmación de contraseña no coincide.", 400);
  }

  assertStrongEnoughPassword(next);

  const matches = await bcrypt.compare(current, user.password);
  if (!matches) {
    throw new AppError("La contraseña actual no es correcta.", 400);
  }

  const hash = await bcrypt.hash(next, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hash }
  });

  await logAudit({
    actorId: userId,
    action: AuditAction.PROFILE_PASSWORD_CHANGED,
    description: `${user.name} cambió su contraseña.`
  });

  return { ok: true };
}

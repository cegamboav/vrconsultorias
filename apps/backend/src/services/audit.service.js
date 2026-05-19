import { prisma } from "@crm/database";

export const AuditAction = {
  USER_CREATED: "USER_CREATED",
  USER_ACTIVATED: "USER_ACTIVATED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_PASSWORD_RESET: "USER_PASSWORD_RESET",
  SERVICE_CREATED: "SERVICE_CREATED",
  SERVICE_UPDATED: "SERVICE_UPDATED",
  SERVICE_ACTIVATED: "SERVICE_ACTIVATED",
  SERVICE_DEACTIVATED: "SERVICE_DEACTIVATED",
  PROFILE_UPDATED: "PROFILE_UPDATED",
  PROFILE_PASSWORD_CHANGED: "PROFILE_PASSWORD_CHANGED"
};

/**
 * @param {{ actorId?: string|null, action: string, description: string, metadata?: object }} entry
 */
export async function logAudit({ actorId = null, action, description, metadata = undefined }) {
  return prisma.auditLog.create({
    data: {
      userId: actorId ?? null,
      action,
      description,
      metadata: metadata ?? undefined
    }
  });
}

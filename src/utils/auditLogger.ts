import prisma from "../lib/prisma";

export async function logAudit(params: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

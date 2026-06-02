import { randomUUID } from "crypto";
import { appMetrics } from "../observability/appMetrics";
import { prisma } from "./database.service";

export interface AuditInput {
  action: string;
  actorId?: string;
  actorType?: "user" | "service" | "system";
  clientId?: string;
  documentId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      id: `audit-${randomUUID()}`,
      action: input.action,
      actorId: input.actorId,
      actorType: input.actorType ?? "user",
      clientId: input.clientId,
      documentId: input.documentId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: JSON.stringify(input.metadata ?? {})
    }
  });
  appMetrics.increment("gateway_audit_logs_total", {
    action: input.action,
    actorType: input.actorType ?? "user"
  });
}

export interface AuditSearchInput {
  action?: string;
  actorId?: string;
  clientId?: string;
  documentId?: string;
  page?: number;
  pageSize?: number;
}

export async function searchAuditLogs(input: AuditSearchInput) {
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 200);
  const where = {
    ...(input.action ? { action: input.action } : {}),
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.documentId ? { documentId: input.documentId } : {})
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.auditLog.count({ where })
  ]);

  return {
    items: items.map((item: any) => ({
      id: item.id,
      action: item.action,
      actorId: item.actorId,
      actorType: item.actorType,
      clientId: item.clientId,
      documentId: item.documentId,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      metadata: safeJson(item.metadata),
      createdAt: item.createdAt.toISOString()
    })),
    page,
    pageSize,
    total
  };
}

function safeJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

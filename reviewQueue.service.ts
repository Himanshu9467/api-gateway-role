import { randomUUID } from "crypto";
import { prisma } from "./database.service";
import { writeAuditLog } from "./audit.service";

export type ReviewQueueStatus = "pending" | "assigned" | "approved" | "rejected" | "escalated";
export type ReviewActionType = "assign" | "approve" | "reject" | "comment" | "escalate";

export interface ReviewQueueItem {
  id: string;
  documentId: string;
  clientId: string;
  ocrResultId?: string;
  status: ReviewQueueStatus;
  priority: string;
  reason: string;
  assignedTo?: string;
  dueAt?: string;
  escalatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export async function ensureReviewQueue(input: {
  documentId: string;
  clientId: string;
  ocrResultId?: string;
  reason: string;
  priority?: "normal" | "high";
}): Promise<ReviewQueueItem> {
  const dueAt = new Date(Date.now() + 2 * 86400000);
  const item = await prisma.reviewQueue.upsert({
    where: { documentId: input.documentId },
    create: {
      id: `review-${randomUUID()}`,
      documentId: input.documentId,
      clientId: input.clientId,
      ocrResultId: input.ocrResultId,
      status: "pending",
      priority: input.priority ?? "normal",
      reason: input.reason,
      dueAt
    },
    update: {
      ocrResultId: input.ocrResultId,
      status: "pending",
      priority: input.priority ?? "normal",
      reason: input.reason,
      dueAt
    }
  });
  return toReviewQueueItem(item);
}

export async function listReviewQueue(input: {
  status?: ReviewQueueStatus;
  assignedTo?: string;
  clientId?: string;
}): Promise<ReviewQueueItem[]> {
  const items = await prisma.reviewQueue.findMany({
    where: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.assignedTo ? { assignedTo: input.assignedTo } : {}),
      ...(input.clientId ? { clientId: input.clientId } : {})
    },
    orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { createdAt: "asc" }]
  });
  return items.map(toReviewQueueItem);
}

export async function assignReviewer(input: {
  reviewQueueId: string;
  reviewerId: string;
  actorId: string;
  comment?: string;
}): Promise<ReviewQueueItem> {
  return recordReviewAction({
    reviewQueueId: input.reviewQueueId,
    action: "assign",
    actorId: input.actorId,
    comment: input.comment,
    data: { status: "assigned", assignedTo: input.reviewerId }
  });
}

export async function approveReview(input: {
  reviewQueueId: string;
  actorId: string;
  comment?: string;
}): Promise<ReviewQueueItem> {
  const item = await recordReviewAction({
    reviewQueueId: input.reviewQueueId,
    action: "approve",
    actorId: input.actorId,
    comment: input.comment,
    data: { status: "approved" }
  });
  await prisma.document.update({ where: { id: item.documentId }, data: { status: "uploaded", rejectionReason: null } });
  return item;
}

export async function rejectReview(input: {
  reviewQueueId: string;
  actorId: string;
  comment: string;
}): Promise<ReviewQueueItem> {
  const item = await recordReviewAction({
    reviewQueueId: input.reviewQueueId,
    action: "reject",
    actorId: input.actorId,
    comment: input.comment,
    data: { status: "rejected" }
  });
  await prisma.document.update({
    where: { id: item.documentId },
    data: { status: "rejected", rejectionReason: input.comment }
  });
  return item;
}

export async function commentOnReview(input: {
  reviewQueueId: string;
  actorId: string;
  comment: string;
}): Promise<ReviewQueueItem> {
  return recordReviewAction({
    reviewQueueId: input.reviewQueueId,
    action: "comment",
    actorId: input.actorId,
    comment: input.comment,
    data: {}
  });
}

export async function escalateReview(input: {
  reviewQueueId: string;
  actorId: string;
  comment?: string;
}): Promise<ReviewQueueItem> {
  return recordReviewAction({
    reviewQueueId: input.reviewQueueId,
    action: "escalate",
    actorId: input.actorId,
    comment: input.comment,
    data: { status: "escalated", priority: "high", escalatedAt: new Date() }
  });
}

async function recordReviewAction(input: {
  reviewQueueId: string;
  action: ReviewActionType;
  actorId: string;
  comment?: string;
  data: Record<string, unknown>;
}): Promise<ReviewQueueItem> {
  const item = await prisma.$transaction(async (tx: typeof prisma) => {
    const updated = await tx.reviewQueue.update({
      where: { id: input.reviewQueueId },
      data: input.data
    });
    await tx.reviewAction.create({
      data: {
        id: `review-action-${randomUUID()}`,
        reviewQueueId: input.reviewQueueId,
        action: input.action,
        actorId: input.actorId,
        comment: input.comment,
        metadata: JSON.stringify(input.data)
      }
    });
    return updated;
  });

  await writeAuditLog({
    action: `review.${input.action}`,
    actorId: input.actorId,
    actorType: "user",
    clientId: item.clientId,
    documentId: item.documentId,
    metadata: { reviewQueueId: item.id, comment: input.comment }
  });

  return toReviewQueueItem(item);
}

function toReviewQueueItem(item: {
  id: string;
  documentId: string;
  clientId: string;
  ocrResultId: string | null;
  status: string;
  priority: string;
  reason: string;
  assignedTo: string | null;
  dueAt: Date | null;
  escalatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ReviewQueueItem {
  return {
    id: item.id,
    documentId: item.documentId,
    clientId: item.clientId,
    ocrResultId: item.ocrResultId ?? undefined,
    status: item.status as ReviewQueueStatus,
    priority: item.priority,
    reason: item.reason,
    assignedTo: item.assignedTo ?? undefined,
    dueAt: item.dueAt?.toISOString(),
    escalatedAt: item.escalatedAt?.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

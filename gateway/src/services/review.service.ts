import { randomUUID } from "crypto";
import { appMetrics } from "../observability/appMetrics";
import { writeAuditLog } from "./audit.service";

export type ReviewDecision = "approved" | "assigned" | "rejected";

export interface ReviewResult {
  reviewId: string;
  decision: ReviewDecision;
  reviewerId?: string;
  reason?: string;
}

/**
 * Review decision rules:
 *   score >= 95  → auto-approved
 *   80 <= score < 95 → assigned to reviewer
 *   score < 80  → auto-rejected
 */
export async function evaluateReview(
  documentId: string,
  score: number,
  valid: boolean
): Promise<ReviewResult> {
  const reviewId = `review-${randomUUID().slice(0, 12)}`;

  let decision: ReviewDecision;
  let reviewerId: string | undefined;
  let reason: string | undefined;

  if (!valid || score < 80) {
    decision = "rejected";
    reason = !valid
      ? "Document validation failed"
      : `Score ${score} below threshold (80)`;
  } else if (score >= 95) {
    decision = "approved";
  } else {
    decision = "assigned";
    reviewerId = `reviewer-${randomUUID().slice(0, 8)}`;
  }

  appMetrics.increment("gateway_review_decisions_total", { decision });

  await writeAuditLog({
    action: `review.${decision}`,
    actorType: "service",
    actorId: decision === "assigned" ? reviewerId! : "review-service",
    documentId,
    metadata: { reviewId, score, valid, decision, reviewerId, reason }
  });

  return { reviewId, decision, reviewerId, reason };
}

export async function approveReview(reviewId: string): Promise<ReviewResult> {
  appMetrics.increment("gateway_review_decisions_total", { decision: "approved" });

  await writeAuditLog({
    action: "review.approved",
    actorType: "service",
    actorId: "review-service",
    metadata: { reviewId }
  });

  return { reviewId, decision: "approved" };
}

export async function rejectReview(reviewId: string, reason: string): Promise<ReviewResult> {
  appMetrics.increment("gateway_review_decisions_total", { decision: "rejected" });

  await writeAuditLog({
    action: "review.rejected",
    actorType: "service",
    actorId: "review-service",
    metadata: { reviewId, reason }
  });

  return { reviewId, decision: "rejected", reason };
}

export async function assignReview(reviewId: string, reviewerId: string): Promise<ReviewResult> {
  appMetrics.increment("gateway_review_decisions_total", { decision: "assigned" });

  await writeAuditLog({
    action: "review.assigned",
    actorType: "service",
    actorId: reviewerId,
    metadata: { reviewId, reviewerId }
  });

  return { reviewId, decision: "assigned", reviewerId };
}

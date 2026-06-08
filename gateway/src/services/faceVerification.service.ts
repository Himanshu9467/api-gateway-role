import { randomUUID } from "crypto";
import { appMetrics } from "../observability/appMetrics";
import { writeAuditLog } from "./audit.service";

export interface FaceVerificationResult {
  verificationId: string;
  score: number;
  passed: boolean;
}

export async function verifyFace(reviewId: string): Promise<FaceVerificationResult> {
  const verificationId = `face-${randomUUID().slice(0, 12)}`;
  const startedAt = process.hrtime.bigint();

  const score = simulateFaceMatch();
  const passed = score >= 0.7;

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  appMetrics.increment("gateway_face_verifications_total", {
    status: passed ? "passed" : "failed"
  });
  appMetrics.increment("gateway_face_verification_duration_ms_sum", {}, Math.round(durationMs));

  await writeAuditLog({
    action: "face.verification.completed",
    actorType: "service",
    actorId: "face-verification-service",
    metadata: {
      verificationId,
      reviewId,
      score,
      passed,
      durationMs: Math.round(durationMs)
    }
  });

  return { verificationId, score, passed };
}

function simulateFaceMatch(): number {
  const base = 0.7 + Math.random() * 0.25;
  return Math.round(base * 100) / 100;
}

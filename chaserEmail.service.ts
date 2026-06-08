import { prisma } from "./database.service";
import { sendOperationalNotification } from "./email.service";
import { writeAuditLog } from "./audit.service";

export interface ChaserEmailSummary {
  type: "reminder" | "pending_document_alert" | "escalation";
  sent: number;
}

export async function sendReminderEmails(): Promise<ChaserEmailSummary> {
  const pending = await prisma.reviewQueue.findMany({
    where: {
      status: { in: ["pending", "assigned"] },
      dueAt: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    },
    include: { client: true, document: true }
  });

  for (const item of pending) {
    await sendOperationalNotification({
      to: item.client.contactEmail,
      subject: "Document review reminder",
      text: `Reminder: ${item.document.fileName} is pending review for ${item.client.name}. Reason: ${item.reason}.`
    });
    await writeAuditLog({
      action: "email.review_reminder",
      actorType: "system",
      clientId: item.clientId,
      documentId: item.documentId,
      metadata: { reviewQueueId: item.id, to: item.client.contactEmail }
    });
  }

  return { type: "reminder", sent: pending.length };
}

export async function sendPendingDocumentAlerts(): Promise<ChaserEmailSummary> {
  const clients = await prisma.client.findMany({
    where: { status: { in: ["pending", "in_progress", "blocked"] } },
    include: { documents: true }
  });
  let sent = 0;

  for (const client of clients) {
    const pendingSteps = requiredSteps.filter(
      (stepKey) => !client.documents.some((document: { stepKey: string }) => document.stepKey === stepKey)
    );
    if (!pendingSteps.length) continue;
    await sendOperationalNotification({
      to: client.contactEmail,
      subject: "Pending onboarding documents",
      text: `Please upload pending onboarding documents for ${client.name}: ${pendingSteps.join(", ")}.`
    });
    sent += 1;
    await writeAuditLog({
      action: "email.pending_documents",
      actorType: "system",
      clientId: client.id,
      metadata: { to: client.contactEmail, pendingSteps }
    });
  }

  return { type: "pending_document_alert", sent };
}

export async function sendEscalationEmails(): Promise<ChaserEmailSummary> {
  const stale = await prisma.reviewQueue.findMany({
    where: {
      status: { in: ["pending", "assigned"] },
      dueAt: { lt: new Date() }
    },
    include: { client: true, document: true }
  });

  for (const item of stale) {
    await prisma.reviewQueue.update({
      where: { id: item.id },
      data: { status: "escalated", priority: "high", escalatedAt: new Date() }
    });
    await sendOperationalNotification({
      to: item.client.contactEmail,
      subject: "Escalated document review",
      text: `${item.document.fileName} for ${item.client.name} has been escalated because review is overdue.`
    });
    await writeAuditLog({
      action: "email.review_escalation",
      actorType: "system",
      clientId: item.clientId,
      documentId: item.documentId,
      metadata: { reviewQueueId: item.id, to: item.client.contactEmail }
    });
  }

  return { type: "escalation", sent: stale.length };
}

const requiredSteps = ["identity", "company_documents", "financial_documents", "compliance"];

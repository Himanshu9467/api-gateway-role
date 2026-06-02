import { randomUUID } from "crypto";
import type { EventBus, EventEnvelope } from "@ai-platform/events";
import { appMetrics } from "../../observability/appMetrics";
import type { Logger } from "../../observability/logger";
import { withTraceMetadata } from "../../observability/tracing";
import type { ParsedCommand } from "../parser/commandParser";

interface WorkflowContext {
  requestId: string;
  clientId: string;
  companyName: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}

export class OnboardClientWorkflow {
  constructor(
    private readonly eventBus: EventBus,
    private readonly logger: Logger
  ) {}

  async execute(command: ParsedCommand, requestId: string) {
    const context: WorkflowContext = {
      requestId,
      clientId: randomUUID(),
      companyName: command.companyName,
      actorId: command.actorId,
      metadata: command.metadata
    };

    this.logStep("workflow.onboard_client.received", context);
    const event = await this.publishClientCreated(context);
    this.logStep("workflow.onboard_client.crm_processing_triggered", context, event);
    this.logStep("workflow.onboard_client.data_room_setup_triggered", context, event);
    this.logStep("workflow.onboard_client.onboarding_started", context, event);

    return {
      workflow: "onboard_client",
      status: "accepted",
      clientId: context.clientId,
      eventId: event.id,
      correlationId: event.correlationId,
      steps: [
        "client.created published",
        "CRM profile creation queued",
        "data-room provisioning queued",
        "onboarding workflow queued"
      ]
    };
  }

  private async publishClientCreated(
    context: WorkflowContext
  ): Promise<EventEnvelope<"client.created">> {
    const event = await this.eventBus.publish(
      "client.created",
      {
        clientId: context.clientId,
        companyName: context.companyName,
        createdBy: context.actorId,
        plan: "growth"
      },
      {
        correlationId: context.requestId,
        idempotencyKey: `client.created:${context.clientId}`,
        targets: ["crm-service", "data-room-service", "onboarding-service"],
        metadata: withTraceMetadata({
          commandIntent: "onboard_client",
          ...context.metadata
        })
      }
    );

    this.logStep("workflow.onboard_client.client_created_published", context, event);
    appMetrics.increment("gateway_events_published_total", {
      event: event.name,
      producer: "gateway"
    });
    return event;
  }

  private logStep(
    message: string,
    context: WorkflowContext,
    event?: EventEnvelope<"client.created">
  ): void {
    this.logger.info(message, {
      requestId: context.requestId,
      route: "/api/ai/commands",
      event: event?.name ?? "workflow.onboard_client",
      status: event ? "queued" : "started",
      correlationId: event?.correlationId ?? context.requestId,
      eventId: event?.id,
      clientId: context.clientId,
      companyName: context.companyName
    });
  }
}

import { env } from "../config/env";
import { Logger } from "../observability/logger";

export type AlertSeverity = "warning" | "critical";

export interface AlertEvent {
  name: string;
  severity: AlertSeverity;
  message: string;
  labels?: Record<string, string | number | undefined>;
}

export interface AlertProvider {
  send(alert: AlertEvent): Promise<void>;
}

export class ConsoleAlertProvider implements AlertProvider {
  constructor(private readonly logger = new Logger(env.SERVICE_NAME)) {}

  async send(alert: AlertEvent): Promise<void> {
    this.logger.warn("alert.triggered", {
      name: alert.name,
      severity: alert.severity,
      message: alert.message,
      labels: alert.labels ?? {}
    });
  }
}

export class SlackWebhookAlertProvider implements AlertProvider {
  async send(alert: AlertEvent): Promise<void> {
    if (!env.SLACK_WEBHOOK_URL) return;
    const response = await fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `[${alert.severity.toUpperCase()}] ${alert.name}: ${alert.message}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${alert.name}* (${alert.severity})\n${alert.message}`
            }
          }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`Slack alert failed with status ${response.status}`);
    }
  }
}

export function createAlertProvider(): AlertProvider {
  return env.ALERT_PROVIDER === "slack" ? new SlackWebhookAlertProvider() : new ConsoleAlertProvider();
}

export async function sendAlert(alert: AlertEvent, provider = createAlertProvider()): Promise<void> {
  try {
    await provider.send(alert);
  } catch (error) {
    await new ConsoleAlertProvider().send({
      ...alert,
      message: `${alert.message} (primary alert provider failed: ${error instanceof Error ? error.message : "unknown"})`
    });
  }
}

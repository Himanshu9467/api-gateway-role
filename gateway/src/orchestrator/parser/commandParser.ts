import { z } from "zod";

export const commandRequestSchema = z.object({
  command: z.string().min(3),
  actorId: z.string().min(1).default("system"),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export interface ParsedCommand {
  intent: "onboard_client";
  companyName: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}

export class CommandParser {
  parse(input: unknown): ParsedCommand {
    const request = commandRequestSchema.parse(input);
    const normalized = request.command.trim();
    const match = /^(?:onboard|create onboarding for)\s+(.+)$/i.exec(normalized);

    if (!match?.[1]) {
      throw new Error(`Unsupported command: ${request.command}`);
    }

    return {
      intent: "onboard_client",
      companyName: match[1].trim(),
      actorId: request.actorId,
      metadata: request.metadata
    };
  }
}

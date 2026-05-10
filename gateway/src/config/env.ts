import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  SERVICE_NAME: z.string().default("api-gateway"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  EVENT_DRIVER: z.enum(["redis", "kafka"]).default("redis"),
  JWT_SECRET: z.string().min(16).default("dev-only-change-this-secret"),
  SERVICE_API_KEYS: z.string().default(""),
  CRM_SERVICE_URL: z.string().url().default("http://localhost:3003"),
  CRM_SERVICE_INSTANCES: z.string().optional(),
  ONBOARDING_SERVICE_URL: z.string().url().default("http://localhost:3002"),
  ONBOARDING_SERVICE_INSTANCES: z.string().optional(),
  DATA_ROOM_SERVICE_URL: z.string().url().default("http://localhost:3001"),
  DATA_ROOM_SERVICE_INSTANCES: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  CIRCUIT_RESET_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(1500)
});

export const env = envSchema.parse(process.env);

import "./loadRootEnv";
import { z } from "zod";

const booleanFromEnv = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase() === "true" : value),
  z.boolean()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  SERVICE_NAME: z.string().default("api-gateway"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/ai_platform?schema=public"),
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
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default("storage/documents"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_PREFIX: z.string().default("documents"),
  ALERT_PROVIDER: z.enum(["console", "slack"]).default("console"),
  EMAIL_PROVIDER: z.enum(["console", "smtp", "ses"]).default("console"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanFromEnv.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().default("no-reply@example.com"),
  APP_BASE_URL: z.string().url().default("http://localhost:4000"),
  SES_REGION: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  ALERT_HIGH_ERROR_RATE_THRESHOLD: z.coerce.number().positive().default(0.05),
  ALERT_HIGH_LATENCY_MS: z.coerce.number().positive().default(1000),
  WORKER_METRICS_PORT: z.coerce.number().int().positive().optional(),
  SECRET_PROVIDER: z.enum(["env", "aws"]).default("env"),
  AWS_SECRETS_REGION: z.string().optional(),
  AWS_SECRETS_JSON_ID: z.string().optional(),
  TRACING_ENABLED: booleanFromEnv.default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  JAEGER_ENDPOINT: z.string().url().optional(),
  AUTH_PROVIDER: z.enum(["local", "auth0", "cognito", "keycloak"]).default("local"),
  AUTH_ROLE_CLAIM: z.string().default("roles"),
  AUTH_DEFAULT_ROLE: z.enum(["admin", "user", "service"]).default("user"),
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_AUDIENCE: z.string().optional(),
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),
  COGNITO_REGION: z.string().optional(),
  KEYCLOAK_ISSUER: z.string().url().optional(),
  KEYCLOAK_AUDIENCE: z.string().optional()
});

export const env = envSchema.superRefine((value, ctx) => {
  if (value.STORAGE_PROVIDER === "s3") {
    if (!value.S3_BUCKET) {
      ctx.addIssue({
        code: "custom",
        path: ["S3_BUCKET"],
        message: "S3_BUCKET is required when STORAGE_PROVIDER=s3"
      });
    }
    if (!value.S3_REGION) {
      ctx.addIssue({
        code: "custom",
        path: ["S3_REGION"],
        message: "S3_REGION is required when STORAGE_PROVIDER=s3"
      });
    }
  }
  if (value.ALERT_PROVIDER === "slack" && !value.SLACK_WEBHOOK_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["SLACK_WEBHOOK_URL"],
      message: "SLACK_WEBHOOK_URL is required when ALERT_PROVIDER=slack"
    });
  }
  if (value.EMAIL_PROVIDER === "smtp") {
    if (!value.SMTP_HOST) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "SMTP_HOST is required when EMAIL_PROVIDER=smtp"
      });
    }
  }
  if (value.EMAIL_PROVIDER === "ses" && !value.SES_REGION) {
    ctx.addIssue({
      code: "custom",
      path: ["SES_REGION"],
      message: "SES_REGION is required when EMAIL_PROVIDER=ses"
    });
  }
  if (value.SECRET_PROVIDER === "aws") {
    if (!value.AWS_SECRETS_REGION) {
      ctx.addIssue({
        code: "custom",
        path: ["AWS_SECRETS_REGION"],
        message: "AWS_SECRETS_REGION is required when SECRET_PROVIDER=aws"
      });
    }
    if (!value.AWS_SECRETS_JSON_ID) {
      ctx.addIssue({
        code: "custom",
        path: ["AWS_SECRETS_JSON_ID"],
        message: "AWS_SECRETS_JSON_ID is required when SECRET_PROVIDER=aws"
      });
    }
  }

  if (value.NODE_ENV === "production") {
    if (!process.env.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL must be set in production"
      });
    }
    if (!process.env.REDIS_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["REDIS_URL"],
        message: "REDIS_URL must be set in production"
      });
    }
    if (
      !process.env.JWT_SECRET ||
      value.JWT_SECRET === "dev-only-change-this-secret" ||
      value.JWT_SECRET === "replace-with-a-long-random-secret" ||
      value.JWT_SECRET.length < 32
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "JWT_SECRET must be a strong secret of at least 32 characters in production"
      });
    }
  }
}).parse(process.env);

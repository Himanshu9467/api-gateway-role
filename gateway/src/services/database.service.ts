import "../config/loadRootEnv";
import { appMetrics } from "../observability/appMetrics";

type PrismaClientConstructor = new (options?: Record<string, unknown>) => {
  $disconnect(): Promise<void>;
  $on?(event: "query", callback: (event: { model?: string; action?: string }) => void): void;
};

const PrismaClientImpl: PrismaClientConstructor =
  process.env.NODE_ENV === "test"
    ? require("../generated/prisma-test").PrismaClient
    : require("@prisma/client").PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma?: InstanceType<PrismaClientConstructor>;
};

export const prisma: any =
  globalForPrisma.prisma ??
  new PrismaClientImpl({
    log:
      process.env.NODE_ENV === "test"
        ? [{ emit: "event", level: "query" }, { emit: "stdout", level: "error" }]
        : [{ emit: "event", level: "query" }, { emit: "stdout", level: "warn" }, { emit: "stdout", level: "error" }]
  });

prisma.$on?.("query", (event: { model?: string; action?: string }) => {
  appMetrics.increment("gateway_db_queries_total", {
    model: event.model ?? "unknown",
    action: event.action ?? "query"
  });
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

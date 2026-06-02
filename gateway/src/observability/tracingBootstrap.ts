import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { env } from "../config/env";

if (env.TRACING_ENABLED) {
  const exporterUrl =
    env.OTEL_EXPORTER_OTLP_ENDPOINT ?? env.JAEGER_ENDPOINT ?? "http://localhost:4318/v1/traces";
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: exporterUrl }),
    instrumentations: [
      getNodeAutoInstrumentations(),
      new PrismaInstrumentation()
    ]
  });

  sdk.start();
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      service: env.SERVICE_NAME,
      message: "tracing.enabled",
      provider: "opentelemetry",
      exporter: exporterUrl
    })
  );

  process.once("SIGTERM", () => {
    void sdk.shutdown();
  });
}

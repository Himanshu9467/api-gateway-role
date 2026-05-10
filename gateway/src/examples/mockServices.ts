import express, { type Request } from "express";

interface MockService {
  name: string;
  port: number;
}

const services: MockService[] = [
  { name: "data-room-service", port: 3001 },
  { name: "onboarding-service", port: 3002 },
  { name: "crm-service", port: 3003 }
];

function log(service: string, message: string, req?: Request): void {
  console.log(
    JSON.stringify({
      requestId: req?.header("x-request-id"),
      timestamp: new Date().toISOString(),
      service,
      route: req?.originalUrl,
      event: message,
      status: "ok"
    })
  );
}

for (const service of services) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health", (req, res) => {
    log(service.name, "health.check", req);
    res.json({
      status: "UP",
      service: service.name,
      timestamp: new Date().toISOString()
    });
  });

  app.use((req, res) => {
    log(service.name, "mock.request.received", req);
    res.json({
      status: "ok",
      service: service.name,
      method: req.method,
      path: req.originalUrl,
      requestId: req.header("x-request-id")
    });
  });

  app.listen(service.port, () => {
    log(service.name, `mock.listening.${service.port}`);
  });
}

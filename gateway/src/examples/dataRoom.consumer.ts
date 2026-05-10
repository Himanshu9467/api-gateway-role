import { startExampleSubscriber } from "./createSubscriber";

void startExampleSubscriber("data-room-service", "client.created", async (event) => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "data-room-service",
      message: "Data-room provisioning started",
      event: event.name,
      status: "started",
      eventId: event.id,
      clientId: event.payload.clientId,
      companyName: event.payload.companyName,
      correlationId: event.correlationId
    })
  );
});

import { startExampleSubscribers } from "./createSubscriber";

void startExampleSubscribers("onboarding-service", [
  {
    eventName: "client.created",
    handler: async (event) => {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          service: "onboarding-service",
          message: "onboarding.workflow.start",
          event: event.name,
          status: "started",
          eventId: event.id,
          clientId: event.payload.clientId,
          companyName: event.payload.companyName,
          correlationId: event.correlationId
        })
      );
    }
  },
  {
    eventName: "document.uploaded",
    handler: async (event) => {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          service: "onboarding-service",
          message: "onboarding.document.received",
          event: event.name,
          status: "received",
          eventId: event.id,
          clientId: event.payload.clientId,
          documentId: event.payload.documentId,
          fileName: event.payload.fileName,
          correlationId: event.correlationId
        })
      );
    }
  }
]);

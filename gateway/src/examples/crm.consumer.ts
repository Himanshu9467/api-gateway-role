import { startExampleSubscribers } from "./createSubscriber";

void startExampleSubscribers("crm-service", [
  {
    eventName: "client.created",
    handler: async (event) => {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          service: "crm-service",
          message: "CRM received client.created",
          event: event.name,
          status: "received",
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
          service: "crm-service",
          message: "CRM received document.uploaded",
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

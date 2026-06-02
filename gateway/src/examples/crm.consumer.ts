import "../observability/tracingBootstrap";
import { startExampleSubscribers } from "./createSubscriber";
import { associateCrmDocument, createCrmRecord } from "../services/crmState.service";

void startExampleSubscribers("crm-service", [
  {
    eventName: "client.created",
    handler: async (event) => {
      const record = await createCrmRecord(event);
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
          crmId: record.crmId,
          correlationId: event.correlationId
        })
      );
    }
  },
  {
    eventName: "document.uploaded",
    handler: async (event) => {
      const record = await associateCrmDocument(event);
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
          crmId: record?.crmId,
          associated: Boolean(record),
          correlationId: event.correlationId
        })
      );
    }
  }
]);

import { startExampleSubscribers } from "./createSubscriber";
import {
  initializeOnboardingState,
  updateOnboardingProgress
} from "../services/onboardingState.service";

void startExampleSubscribers("onboarding-service", [
  {
    eventName: "client.created",
    handler: async (event) => {
      const state = initializeOnboardingState(event);
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
          progressPercent: state.progressPercent,
          onboardingStatus: state.status,
          correlationId: event.correlationId
        })
      );
    }
  },
  {
    eventName: "document.uploaded",
    handler: async (event) => {
      const state = updateOnboardingProgress(event);
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
          progressPercent: state.progressPercent,
          onboardingStatus: state.status,
          correlationId: event.correlationId
        })
      );
    }
  }
]);

import "../observability/tracingBootstrap";
import { startExampleSubscriber } from "./createSubscriber";
import { provisionDataRoom } from "../services/dataRoomState.service";

void startExampleSubscriber("data-room-service", "client.created", async (event) => {
  const room = await provisionDataRoom(event);
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
      roomId: room.roomId,
      createdAt: room.createdAt,
      correlationId: event.correlationId
    })
  );
});

import type { EventEnvelope } from "@ai-platform/events";

export interface DataRoomMetadata {
  roomId: string;
  clientId: string;
  createdAt: string;
}

const roomsByClient = new Map<string, DataRoomMetadata>();

export function provisionDataRoom(event: EventEnvelope<"client.created">): DataRoomMetadata {
  const existing = roomsByClient.get(event.payload.clientId);
  if (existing) return existing;

  const room: DataRoomMetadata = {
    roomId: `room-${event.payload.clientId}`,
    clientId: event.payload.clientId,
    createdAt: new Date().toISOString()
  };

  roomsByClient.set(room.clientId, room);
  return room;
}

export function getDataRoom(clientId: string): DataRoomMetadata | undefined {
  return roomsByClient.get(clientId);
}

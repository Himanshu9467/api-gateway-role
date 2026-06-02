import type { EventEnvelope } from "@ai-platform/events";
import { prisma } from "./database.service";

export interface DataRoomMetadata {
  roomId: string;
  clientId: string;
  createdAt: string;
}

export async function provisionDataRoom(
  event: EventEnvelope<"client.created">
): Promise<DataRoomMetadata> {
  await ensureEventClient(event);
  const room = await prisma.dataRoom.upsert({
    where: { clientId: event.payload.clientId },
    create: {
      roomId: `room-${event.payload.clientId}`,
      clientId: event.payload.clientId,
      createdAt: new Date()
    },
    update: {}
  });

  return {
    roomId: room.roomId,
    clientId: room.clientId,
    createdAt: room.createdAt.toISOString()
  };
}

async function ensureEventClient(event: EventEnvelope<"client.created">): Promise<void> {
  await prisma.client.upsert({
    where: { id: event.payload.clientId },
    create: {
      id: event.payload.clientId,
      name: event.payload.companyName,
      contactPerson: "Unknown",
      contactEmail: "unknown@example.com",
      jurisdiction: "Unknown",
      serviceTier: planToServiceTier(event.payload.plan),
      clientType: "Corporate",
      status: "pending",
      progressPercent: 0,
      updatedAt: new Date()
    },
    update: {}
  });
}

function planToServiceTier(plan: string): string {
  if (plan === "starter") return "Starter";
  if (plan === "enterprise") return "Enterprise";
  return "Professional";
}

export async function getDataRoom(clientId: string): Promise<DataRoomMetadata | undefined> {
  const room = await prisma.dataRoom.findUnique({ where: { clientId } });
  return room
    ? {
        roomId: room.roomId,
        clientId: room.clientId,
        createdAt: room.createdAt.toISOString()
      }
    : undefined;
}

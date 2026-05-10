import { env } from "./env";

export type ServiceName = "onboarding" | "crm" | "dataRoom";
export type PublicServiceName = "onboarding" | "crm" | "data-room";

export interface ServiceInstanceConfig {
  url: string;
  health: string;
}

export interface ServiceRegistryEntry {
  name: ServiceName;
  publicName: PublicServiceName;
  routePrefix: string;
  instances: ServiceInstanceConfig[];
  allowedRoles: Array<"admin" | "user" | "service">;
}

function parseInstances(value: string | undefined, fallbackUrl: string): ServiceInstanceConfig[] {
  const urls = value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [fallbackUrl];

  return urls.map((url) => ({
    url,
    health: "/health"
  }));
}

export const serviceRegistry: Record<ServiceName, ServiceRegistryEntry> = {
  onboarding: {
    name: "onboarding",
    publicName: "onboarding",
    routePrefix: "/api/onboarding",
    instances: parseInstances(env.ONBOARDING_SERVICE_INSTANCES, env.ONBOARDING_SERVICE_URL),
    allowedRoles: ["user", "admin"]
  },
  crm: {
    name: "crm",
    publicName: "crm",
    routePrefix: "/api/crm",
    instances: parseInstances(env.CRM_SERVICE_INSTANCES, env.CRM_SERVICE_URL),
    allowedRoles: ["admin"]
  },
  dataRoom: {
    name: "dataRoom",
    publicName: "data-room",
    routePrefix: "/api/data-room",
    instances: parseInstances(env.DATA_ROOM_SERVICE_INSTANCES, env.DATA_ROOM_SERVICE_URL),
    allowedRoles: ["user", "admin", "service"]
  }
};

export const serviceRoutes = Object.values(serviceRegistry);

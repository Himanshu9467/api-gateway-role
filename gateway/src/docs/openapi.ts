export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "AI Platform API Gateway",
    version: "1.0.0",
    description: "Central API Gateway and Redis/BullMQ event communication layer."
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local gateway"
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      },
      serviceApiKey: {
        type: "apiKey",
        in: "header",
        name: "x-api-key"
      }
    }
  },
  paths: {
    "/health": {
      get: {
        summary: "Gateway health",
        responses: {
          "200": {
            description: "Gateway is healthy"
          }
        }
      }
    },
    "/health/services": {
      get: {
        summary: "Downstream service health",
        responses: {
          "200": {
            description: "All services have at least one healthy instance"
          },
          "207": {
            description: "One or more services are degraded"
          }
        }
      }
    },
    "/health/events": {
      get: {
        summary: "Event queue and DLQ health",
        responses: {
          "200": {
            description: "Event queues are healthy"
          },
          "207": {
            description: "Event queue failures or dead letters exist"
          }
        }
      }
    },
    "/metrics": {
      get: {
        summary: "Prometheus-compatible gateway metrics",
        responses: {
          "200": {
            description: "Metrics in Prometheus text exposition format"
          }
        }
      }
    },
    "/api/events/client-created": {
      post: {
        summary: "Publish client.created event",
        security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                companyName: "Company X",
                createdBy: "admin-1",
                plan: "growth"
              }
            }
          }
        },
        responses: {
          "202": {
            description: "Event accepted and queued"
          },
          "401": {
            description: "Missing or invalid authentication"
          },
          "403": {
            description: "Role is not allowed to publish this event"
          }
        }
      }
    },
    "/api/events/document-uploaded": {
      post: {
        summary: "Publish document.uploaded event",
        security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                clientId: "client-12345",
                fileName: "msa.pdf",
                uploadedBy: "admin-1"
              }
            }
          }
        },
        responses: {
          "202": {
            description: "Event accepted and queued"
          },
          "401": {
            description: "Missing or invalid authentication"
          },
          "403": {
            description: "Role is not allowed to publish this event"
          }
        }
      }
    },
    "/api/ai/commands": {
      post: {
        summary: "Run orchestration command",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                command: "Onboard Company X",
                actorId: "user-123"
              }
            }
          }
        },
        responses: {
          "202": {
            description: "Workflow accepted"
          }
        }
      }
    },
    "/api/crm/{path}": {
      parameters: [{ name: "path", in: "path", required: true, schema: { type: "string" } }],
      post: {
        summary: "Proxy request to CRM service",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Proxied response"
          }
        }
      }
    },
    "/api/onboarding/{path}": {
      parameters: [{ name: "path", in: "path", required: true, schema: { type: "string" } }],
      post: {
        summary: "Proxy request to onboarding service",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Proxied response"
          }
        }
      }
    },
    "/api/data-room/{path}": {
      parameters: [{ name: "path", in: "path", required: true, schema: { type: "string" } }],
      post: {
        summary: "Proxy request to data-room service",
        security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
        responses: {
          "200": {
            description: "Proxied response"
          }
        }
      }
    }
  }
} as const;

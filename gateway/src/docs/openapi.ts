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
    "/api/auth/forgot-password": {
      post: {
        summary: "Request password reset instructions",
        requestBody: {
          required: true,
          content: { "application/json": { example: { email: "user@example.com" } } }
        },
        responses: {
          "202": { description: "Accepted without revealing whether the account exists" },
          "429": { description: "Rate limit exceeded" }
        }
      }
    },
    "/api/auth/reset-password": {
      post: {
        summary: "Reset password using a one-time token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: { token: "opaque-token-from-email", password: "NewStrong1!" }
            }
          }
        },
        responses: {
          "204": { description: "Password reset completed" },
          "400": { description: "Invalid, expired, or weak reset request" },
          "429": { description: "Rate limit exceeded" }
        }
      }
    },
    "/api/auth/verify-email": {
      post: {
        summary: "Verify email using a one-time token",
        requestBody: {
          required: true,
          content: { "application/json": { example: { token: "opaque-token-from-email" } } }
        },
        responses: {
          "200": { description: "Email verified" },
          "400": { description: "Invalid or expired verification token" },
          "429": { description: "Rate limit exceeded" }
        }
      }
    },
    "/api/auth/resend-verification": {
      post: {
        summary: "Resend email verification instructions",
        requestBody: {
          required: true,
          content: { "application/json": { example: { email: "user@example.com" } } }
        },
        responses: {
          "202": { description: "Accepted without revealing whether the account exists" },
          "429": { description: "Rate limit exceeded" }
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
    },
    "/api/ocr/extract": {
      post: {
        summary: "Extract text from document via OCR",
        security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                documentId: "doc-12345678",
                fileContent: "Sample document text content",
                clientId: "client-12345"
              }
            }
          }
        },
        responses: {
          "202": { description: "OCR extraction accepted and document.ocr.completed event queued" },
          "401": { description: "Missing or invalid authentication" },
          "403": { description: "Insufficient role" }
        }
      }
    },
    "/api/validation/document": {
      post: {
        summary: "Validate extracted document content",
        security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                documentId: "doc-12345678",
                extractedText: "Full name: John Doe. ID: ABC123456",
                confidence: 0.92
              }
            }
          }
        },
        responses: {
          "202": { description: "Validation completed and document.validation.completed event queued" },
          "401": { description: "Missing or invalid authentication" },
          "403": { description: "Insufficient role" }
        }
      }
    },
    "/api/review/assign": {
      post: {
        summary: "Assign a review to a reviewer",
        security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                reviewId: "review-12345678",
                reviewerId: "reviewer-12345"
              }
            }
          }
        },
        responses: {
          "202": { description: "Review assigned and review.assigned event queued" },
          "401": { description: "Missing or invalid authentication" },
          "403": { description: "Insufficient role" }
        }
      }
    },
    "/api/review/approve": {
      post: {
        summary: "Approve a review",
        security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                reviewId: "review-12345678"
              }
            }
          }
        },
        responses: {
          "202": { description: "Review approved and review.approved event queued" },
          "401": { description: "Missing or invalid authentication" },
          "403": { description: "Insufficient role" }
        }
      }
    },
    "/api/review/reject": {
      post: {
        summary: "Reject a review",
        security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                reviewId: "review-12345678",
                reason: "Document quality insufficient"
              }
            }
          }
        },
        responses: {
          "202": { description: "Review rejected and review.rejected event queued" },
          "401": { description: "Missing or invalid authentication" },
          "403": { description: "Insufficient role" }
        }
      }
    },
    "/api/crm/sync": {
      post: {
        summary: "Trigger CRM synchronization for a customer",
        security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                customerId: "client-12345678"
              }
            }
          }
        },
        responses: {
          "202": { description: "CRM sync completed and crm.sync.completed event queued" },
          "401": { description: "Missing or invalid authentication" },
          "403": { description: "Insufficient role" }
        }
      }
    },
    "/api/events/replay": {
      post: {
        summary: "Replay a failed event from the dead letter queue",
        security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                eventName: "document.uploaded",
                consumerName: "ocr-service",
                jobId: "event-abc123-ocr-service"
              }
            }
          }
        },
        responses: {
          "200": { description: "Event replayed successfully" },
          "404": { description: "Job not found in DLQ" },
          "401": { description: "Missing or invalid authentication" },
          "403": { description: "Insufficient role" }
        }
      }
    }
  }
} as const;

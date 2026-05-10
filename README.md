# AI Platform Communication Backbone

Production-grade TypeScript gateway and event backbone for microservice communication.

## Internship Role Coverage

This project covers the API Gateway & Event System Engineer role by implementing:

- Single API gateway entry point on `:4000`
- Proxy routing for `/api/onboarding`, `/api/crm`, and `/api/data-room`
- JWT authentication, service API keys, and RBAC
- Protected orchestration command route for `admin` and `user` roles
- Redis-backed rate limiting with in-memory fallback and standard response headers
- Structured JSON request logs with request/correlation IDs
- Redis/BullMQ event package with publisher, subscriber, retries, idempotency, and DLQs
- Event flows for `client.created` and `document.uploaded`
- Service discovery with round-robin routing and health polling
- Gateway, service, and event queue health endpoints
- OpenAPI route documentation at `/openapi.json`
- Prometheus-compatible metrics at `/metrics`
- Lightweight mock services and workers for communication testing

## Structure

```text
API Gateway & Event System Engineer/
  gateway/                 # This repo uses gateway/ at workspace root
packages/
  events/                  # @ai-platform/events shared BullMQ event package
gateway/
  src/
    config/
    examples/
    middleware/
    orchestration/
    observability/
    routes/
    services/
    utils/
```

## Runtime

- API Gateway: `http://localhost:4000`
- Redis: `redis://localhost:6379`
- Proxies:
  - `/api/onboarding` -> `:3002`
  - `/api/crm` -> `:3003`
  - `/api/data-room` -> `:3001`

## Commands

```bash
npm install
npm run build
npm test
docker compose up redis
npm run mock:services
npm run dev:gateway
npm run worker:crm
npm run worker:data-room
npm run worker:onboarding
```

`mock:services` starts lightweight HTTP mocks for gateway proxy testing:

- data-room-service: `http://localhost:3001`
- onboarding-service: `http://localhost:3002`
- crm-service: `http://localhost:3003`

`npm test` runs integration tests for:

- Missing, expired, and role-mismatched JWT handling
- Admin RBAC success path
- Redis-compatible rate limiting
- Event route publishing for `document.uploaded`
- OpenAPI route documentation
- Prometheus-style metrics export

## AI Orchestration Example

```bash
curl -X POST http://localhost:4000/api/ai/commands \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d "{\"command\":\"Onboard Company X\",\"actorId\":\"user-123\"}"
```

## Direct Event Flow Test

Create a short-lived admin JWT using the same `JWT_SECRET` as the gateway:

```bash
node -e "console.log(require('jsonwebtoken').sign({sub:'admin-1',roles:['admin']}, process.env.JWT_SECRET || 'dev-only-change-this-secret', {expiresIn:'15m'}))"
```

Then publish `client.created` through the gateway:

```bash
curl -X POST http://localhost:4000/api/events/client-created \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d "{\"companyName\":\"Company X\",\"createdBy\":\"admin-1\"}"
```

Expected worker output includes:

- `CRM received client.created`
- `Data-room provisioning started`

Expected gateway response:

```json
{
  "status": "accepted",
  "event": "client.created",
  "targets": ["crm-service", "data-room-service"]
}
```

Publish `document.uploaded` through the gateway:

```bash
curl -X POST http://localhost:4000/api/events/document-uploaded \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d "{\"clientId\":\"client-12345\",\"fileName\":\"msa.pdf\",\"uploadedBy\":\"admin-1\"}"
```

Expected worker output includes:

- `CRM received document.uploaded`
- `onboarding.document.received`

Protected proxy routes require either `Authorization: Bearer <jwt>` or `x-api-key: <service-key>`.
JWT payloads use `sub` plus `roles`, where roles are `admin`, `user`, or `service`.

RBAC:

- `/api/crm` accepts `admin`
- `/api/onboarding` accepts `admin` and `user`
- `/api/data-room` accepts `admin`, `user`, and `service`

The gateway publishes `client.created` with one versioned envelope. BullMQ fanout queues deliver the same event to:

- `crm-service`
- `data-room-service`
- `onboarding-service`

The gateway publishes `document.uploaded` to:

- `crm-service`
- `onboarding-service`

Each consumer has independent retries, idempotency, structured JSON logs, and a dead-letter queue.

## Health

```bash
curl http://localhost:4000/health
curl http://localhost:4000/health/services
curl http://localhost:4000/health/events
```

Gateway and worker logs are structured JSON and include `requestId`, `timestamp`, `service`, `route` when available, `event`, and `status` fields for tracing.

## Documentation And Metrics

```bash
curl http://localhost:4000/openapi.json
curl http://localhost:4000/metrics
```

`/openapi.json` documents gateway routes, auth schemes, event publishing endpoints, health checks, metrics, and proxy routes.
`/metrics` exports Prometheus-compatible gateway uptime, request count, and request duration metrics.

## Work Status

The API Gateway & Event System Engineer scope is complete and ready to demo.

Completed:

- Gateway routing and service proxying
- JWT auth, service API keys, and RBAC
- Redis-backed rate limiting with fallback
- Structured request and event logging
- Redis/BullMQ event publishing and subscription
- Retries, idempotency, and dead-letter queues
- `client.created` and `document.uploaded` communication flows
- Service discovery and health checks
- Event queue health checks
- OpenAPI documentation
- Prometheus-compatible metrics
- Integration tests for the core gateway behavior

Signed off: work complete.


# AI Investment Platform – API Gateway & Event System

## Project Overview

This project implements a microservices communication architecture using an API Gateway and event-driven system.

The API Gateway handles:

* request routing
* authentication
* authorization
* service discovery
* rate limiting
* logging
* orchestration

The platform uses Redis and BullMQ for asynchronous communication between services.

---

## Technologies Used

* Node.js
* TypeScript
* Express.js
* Redis
* BullMQ
* Docker
* Zod
* JWT Authentication

---

## Microservices

* API Gateway
* CRM Service
* Onboarding Service
* Data-room Service

---

## Event-Driven Architecture

The platform uses asynchronous communication through events.

Example flow:

Client Request
→ API Gateway
→ Event Published
→ Redis Queue
→ Worker Consumes Event
→ Service Reacts

---

## Main Features

### API Gateway

* Reverse proxy routing
* JWT/API Key authentication
* Role-based access control
* Request logging
* Rate limiting
* Health monitoring

### Event System

* Redis event bus
* BullMQ queues
* Event publisher/subscriber
* Worker consumers
* Retry mechanism
* Dead-letter queue structure
* Idempotency handling

### Orchestration

* Multi-service workflow coordination
* Event-based workflow execution

---

## Health Endpoints

* `/health`
* `/health/services`

---

## Event Routes

### Client Created Event

POST `/api/events/client-created`

### Document Uploaded Event

POST `/api/events/document-uploaded`

---

## Running the Project

### Start Redis

```bash
redis-server
```

### Start Services

```bash
cd crm
npm run Dev
```

```bash
cd data-room
npm run Dev
```

```bash
cd onboarding
npm run dev
```

### Start Workers

```bash
npm run worker:crm
```

```bash
npm run worker:onboarding
```

```bash
npm run worker:data-room
```

### Start Gateway

```bash
npm run dev
```

---

## Author Role

API Gateway & Event System Engineer

Responsibilities:

* API Gateway implementation
* Event-driven communication
* Redis + BullMQ integration
* Worker consumers
* Service orchestration
* Logging and monitoring
* Health checks
* Async communication workflows

## Project Screenshots
[Event Publishing Success](202-accepted.png) 
[CRM Service](Crm.png) 
[Data-Room service](Data_room.png) 
[API Gateway Running](Gateway_running.png) 
[Health](Healthy.png) 
[Onboarding Services](Onboarding.png) 
[services](Services.png) 
[Worker-CRM](Worker_crm.png) 
[Worker-Onboarding](Worker_Onboarding.png) 
[Worker-Data-Room](Worker-Data_room.png)

## Team Members

* Himanshu Shekhar – API Gateway & Event System Engineer
* Pavithra - Onboarding Backend Engineer
* Mahika - AI Engineer
* Darshan - Frontend Developer (React UI Engineer)
* Rahul - Dashboard & Integration Engineer

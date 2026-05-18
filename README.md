# AI Platform Communication Backbone

Production-grade TypeScript API gateway and Redis/BullMQ event backbone for microservice communication.

## Project Status

The API Gateway and event system are working and covered by integration tests. The gateway now supports both backend service communication and the frontend-facing dashboard integration through authenticated API routes backed by clean in-memory mock data until persistent service storage is added.

Completed:

- API gateway entry point on `http://localhost:4000`
- Proxy routing for onboarding, CRM, and data-room services
- JWT authentication, service API keys, and RBAC middleware
- Frontend-facing auth, dashboard, client, onboarding, and chat API contracts
- Redis-backed rate limiting with in-memory fallback
- Structured JSON request and event logs with request/correlation IDs
- Redis/BullMQ event publishing and worker consumption
- Independent consumer retries, idempotency handling, and dead-letter queues
- Event flows for `client.created` and `document.uploaded`
- AI orchestration command route for onboarding workflows
- Service discovery with round-robin routing, health polling, and circuit breaking
- Gateway, downstream service, and event queue health endpoints
- Prometheus-compatible metrics and OpenAPI route documentation
- Integration tests for gateway auth, RBAC, rate limiting, event publishing, frontend-facing routes, docs, and metrics

## Architecture

```text
api-gateway-project/
  gateway/                 # Express + TypeScript API Gateway
    src/
      config/              # env and service registry config
      docs/                # OpenAPI document
      examples/            # mock services and worker consumers
      middleware/          # auth, RBAC, rate limit, logging, error handling
      observability/       # JSON logger and Prometheus metrics
      orchestrator/        # command parser and onboarding workflow
      routes/              # gateway route modules
      services/            # proxy, health, circuit breaker, service registry
      utils/               # request ID utilities
  packages/
    events/                # @ai-platform/events Redis/BullMQ event package
  crm/                     # lightweight CRM service mock
  onboarding/              # lightweight onboarding service mock
  data-room/               # lightweight data-room service mock
  frontend/                # React client consuming gateway APIs
```

## Runtime Services

- API Gateway: `http://localhost:4000`
- Redis: `redis://localhost:6379`
- Data-room service: `http://localhost:3001`
- Onboarding service: `http://localhost:3002`
- CRM service: `http://localhost:3003`

Proxy routes:

- `/api/onboarding/*` -> onboarding service
- `/api/crm/*` -> CRM service
- `/api/data-room/*` -> data-room service

## Technology Stack

- Node.js
- TypeScript
- Express
- Redis
- BullMQ
- Docker Compose
- Zod
- JWT
- Prometheus-style metrics

## Setup

Install dependencies:

```bash
npm install
```

Start Redis:

```bash
docker compose up redis
```

Build the shared event package and gateway:

```bash
npm run build
```

Run integration tests:

```bash
npm test
```

Start lightweight downstream mock services for proxy testing:

```bash
npm run mock:services
```

Start the gateway in development mode:

```bash
npm run dev:gateway
```

Start worker consumers in separate terminals:

```bash
npm run worker:crm
npm run worker:onboarding
npm run worker:data-room
```

If you want to run the simple service folders directly instead of `mock:services`, use:

```bash
node crm/index.js
node onboarding/index.js
node data-room/index.js
```

## Environment

Copy `.env.example` values into your environment or a local `.env` file as needed.

Important variables:

- `PORT`
- `REDIS_URL`
- `EVENT_DRIVER`
- `JWT_SECRET`
- `SERVICE_API_KEYS`
- `CRM_SERVICE_URL`
- `ONBOARDING_SERVICE_URL`
- `DATA_ROOM_SERVICE_URL`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`

## Gateway APIs

### Auth

These routes issue gateway-compatible JWTs for local integration and demo flows:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/signup`

### Dashboard And Client APIs

These authenticated routes support the integrated dashboard experience with typed in-memory mock data:

- `GET /api/dashboard/summary`
- `GET /api/dashboard/clients`
- `GET /api/dashboard/activity`
- `POST /api/clients`
- `GET /api/clients/:clientId`

### Onboarding APIs

These authenticated gateway routes provide onboarding progress and document data until persistent downstream logic is added:

- `GET /api/onboarding/:clientId/progress`
- `GET /api/onboarding/:clientId/documents?step=<stepKey>`
- `POST /api/onboarding/:clientId/documents/upload`

### Chat APIs

These authenticated routes provide mock assistant responses for onboarding support:

- `GET /api/ai/chat/messages?clientId=<id>&stepKey=<stepKey>`
- `POST /api/ai/chat`

### Orchestration

```bash
curl -X POST http://localhost:4000/api/ai/commands \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d "{\"command\":\"Onboard Company X\",\"actorId\":\"user-123\"}"
```

The orchestration workflow publishes `client.created` to CRM, data-room, and onboarding worker queues.

## Event Routes

Create a short-lived admin JWT using the same `JWT_SECRET` as the gateway:

```bash
node -e "console.log(require('jsonwebtoken').sign({sub:'admin-1',roles:['admin']}, process.env.JWT_SECRET || 'dev-only-change-this-secret', {expiresIn:'15m'}))"
```

Publish `client.created`:

```bash
curl -X POST http://localhost:4000/api/events/client-created \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d "{\"companyName\":\"Company X\",\"createdBy\":\"admin-1\"}"
```

Expected response:

```json
{
  "status": "accepted",
  "event": "client.created",
  "targets": ["crm-service", "data-room-service"]
}
```

Publish `document.uploaded`:

```bash
curl -X POST http://localhost:4000/api/events/document-uploaded \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d "{\"clientId\":\"client-12345\",\"fileName\":\"msa.pdf\",\"uploadedBy\":\"admin-1\"}"
```

Expected worker output includes:

- `CRM received client.created`
- `Data-room provisioning started`
- `onboarding.workflow.start`
- `CRM received document.uploaded`
- `onboarding.document.received`

## Event Architecture

The shared `@ai-platform/events` package provides:

- Redis event bus adapter
- BullMQ fanout queues per event and consumer
- Publisher and subscriber abstractions
- Zod event schema validation
- Idempotency store
- Retry and exponential backoff configuration
- Per-consumer dead-letter queues
- Queue statistics for health checks

Implemented event names:

- `client.created`
- `client.onboarded`
- `document.uploaded`
- `workflow.completed`

Current gateway-published flows:

- `/api/events/client-created` publishes `client.created` to `crm-service` and `data-room-service`
- `/api/events/document-uploaded` publishes `document.uploaded` to `crm-service` and `onboarding-service`
- `/api/ai/commands` publishes `client.created` to `crm-service`, `data-room-service`, and `onboarding-service`

## Authentication And RBAC

Protected gateway routes require either:

- `Authorization: Bearer <jwt>`
- `x-api-key: <service-key>`

JWT payloads use:

```json
{
  "sub": "user-or-service-id",
  "roles": ["admin", "user"]
}
```

Roles are `admin`, `user`, and `service`.

RBAC rules:

- `/api/crm/*`: `admin`
- `/api/onboarding/*`: `admin`, `user`
- `/api/data-room/*`: `admin`, `user`, `service`
- `/api/events/client-created`: `admin`, `service`
- `/api/events/document-uploaded`: `admin`, `user`, `service`
- `/api/dashboard/*`: `admin`, `user`
- `/api/clients/*`: `admin`, `user`
- `/api/ai/commands`: `admin`, `user`
- `/api/ai/chat*`: `admin`, `user`

## Health, Docs, And Metrics

```bash
curl http://localhost:4000/health
curl http://localhost:4000/health/services
curl http://localhost:4000/health/events
curl http://localhost:4000/openapi.json
curl http://localhost:4000/metrics
```

- `/health` reports gateway health
- `/health/services` reports downstream service health
- `/health/events` reports BullMQ queue and DLQ health
- `/openapi.json` documents gateway auth, events, proxy routes, health, and metrics
- `/metrics` exports gateway uptime, request count, and request duration metrics

Gateway and worker logs are structured JSON and include request IDs, correlation IDs, event IDs, service names, routes, and status fields where available.

## Testing

`npm test` runs gateway integration tests for:

- Missing, expired, and role-mismatched JWT handling
- Admin RBAC success path
- Redis-compatible rate limiting behavior
- Event route publishing for `document.uploaded`
- Frontend-facing auth, dashboard, client, onboarding, and chat route contracts
- OpenAPI route documentation
- Prometheus-style metrics export

## Project Screenshots

- [Event Publishing Success](202-accepted.png)
- [CRM Service](Crm.png)
- [Data-room Service](Data_room.png)
- [API Gateway Running](Gateway_running.png)
- [Health](Healthy.png)
- [Onboarding Service](Onboarding.png)
- [Services](Services.png)
- [Worker CRM](Worker_crm.png)
- [Worker Onboarding](Worker_Onboarding.png)
- [Worker Data-room](Worker-Data_room.png)

## Team Members

- Himanshu Shekhar - API Gateway & Event System Engineer
- Pavithra - Onboarding Backend Engineer
- Mahika - AI Engineer
- Darshan - Frontend Developer (React UI Engineer)
- Rahul - Dashboard & Integration Engineer

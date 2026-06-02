# AI Platform Communication Backbone

Production-grade TypeScript API gateway and Redis/BullMQ event backbone for microservice communication.

## Project Status

The API Gateway and event system are working and covered by integration tests. The gateway now supports both backend service communication and the frontend-facing dashboard integration through authenticated API routes backed by PostgreSQL persistence via Prisma.

Completed:

- API gateway entry point on `http://localhost:4000`
- Proxy routing for onboarding, CRM, and data-room services
- JWT authentication, service API keys, and RBAC middleware
- Frontend-facing auth, dashboard, client, onboarding, and chat API contracts
- Redis-backed rate limiting with in-memory fallback
- Structured JSON request and event logs with request/correlation IDs
- Redis/BullMQ event publishing and worker consumption
- PostgreSQL persistence with Prisma for clients, documents, onboarding progress, CRM records, and data rooms
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
  prisma/                  # Prisma schema, migrations, and seed data
  crm/                     # lightweight CRM service mock
  onboarding/              # lightweight onboarding service mock
  data-room/               # lightweight data-room service mock
  frontend/                # React client consuming gateway APIs
```

## Runtime Services

- API Gateway: `http://localhost:4000`
- Redis: `redis://localhost:6379`
- PostgreSQL: `postgresql://postgres:postgres@localhost:5432/ai_platform?schema=public`
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
- PostgreSQL
- Prisma ORM
- Zod
- JWT
- Prometheus-style metrics

## Setup

Install dependencies:

```bash
npm install
```

Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

Generate Prisma Client, apply migrations, and seed demo data:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

Build the shared event package and gateway:

```bash
npm run build
```

Run integration tests:

```bash
npm run prisma:test:prepare
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

Copy `.env.example` to `.env` at the repository root. The gateway, Prisma scripts, tests, and local Docker Compose workflow all use this single root `.env`; do not create or depend on `gateway/.env`.

Important variables:

- `PORT`
- `REDIS_URL`
- `DATABASE_URL`
- `EVENT_DRIVER`
- `JWT_SECRET`
- `SERVICE_API_KEYS`
- `CRM_SERVICE_URL`
- `ONBOARDING_SERVICE_URL`
- `DATA_ROOM_SERVICE_URL`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `STORAGE_PROVIDER`
- `LOCAL_STORAGE_DIR`
- `S3_BUCKET`
- `S3_REGION`
- `ALERT_PROVIDER`
- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `APP_BASE_URL`
- `SLACK_WEBHOOK_URL`
- `SECRET_PROVIDER`
- `AWS_SECRETS_JSON_ID`
- `WORKER_METRICS_PORT`
- `TRACING_ENABLED`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

In production, `DATABASE_URL`, `REDIS_URL`, and a strong `JWT_SECRET` of at least 32 characters are required. The gateway refuses to start in production if these checks fail or Redis is unreachable.

## Gateway APIs

### Auth

These routes issue gateway-compatible JWTs for local integration and demo flows:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/signup`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`

Passwords are stored as bcrypt hashes. Registration enforces password strength, login verifies the stored hash, access tokens remain JWTs, and refresh tokens are opaque, hashed at rest, rotated on every refresh, and revocable on logout.
Password reset and email verification tokens are opaque, hashed at rest, expiring, single-use, rate-limited, and audited. Forgot-password and resend-verification responses do not reveal whether an account exists.

### Dashboard And Client APIs

These authenticated routes support the integrated dashboard experience with Prisma-backed persisted data:

- `GET /api/dashboard/summary`
- `GET /api/dashboard/clients`
- `GET /api/dashboard/activity`
- `POST /api/clients`
- `GET /api/clients/:clientId`

### Onboarding APIs

These authenticated gateway routes provide persisted onboarding progress and document data:

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
- `/api/clients` inserts a client in PostgreSQL, then publishes `client.created` to `crm-service`, `data-room-service`, and `onboarding-service`
- `/api/onboarding/:clientId/documents/upload` inserts a document in PostgreSQL, then publishes `document.uploaded` to `crm-service` and `onboarding-service`

## Database And Prisma

Primary database schema:

- `prisma/schema.prisma`: PostgreSQL Prisma schema used by the application.
- `prisma/schema.test.prisma`: SQLite-compatible schema used by integration tests.
- `prisma/migrations/20260601160000_init/migration.sql`: initial PostgreSQL migration.
- `prisma/seed.ts`: demo data for dashboard and worker-owned state.

Tables:

- `Client`: dashboard client summary and onboarding status source.
- `Document`: uploaded onboarding documents linked to `Client`.
- `Activity`: dashboard activity feed entries.
- `ChatMessage`: persisted onboarding chat exchanges.
- `OnboardingProgress`: worker-owned onboarding workflow state linked one-to-one to `Client`.
- `OnboardingCompletedStep`: normalized completed steps for onboarding progress.
- `CRMRecord`: worker-owned CRM record linked one-to-one to `Client`.
- `CRMDocumentAssociation`: CRM document associations created from `document.uploaded`.
- `DataRoom`: worker-owned room metadata linked one-to-one to `Client`.

Prisma commands:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
npm run prisma:test:prepare
```

Migration commands:

```bash
docker compose up -d postgres
npm run prisma:migrate
```

For deployment-style migration application:

```bash
npm run prisma:deploy
```

Seed commands:

```bash
npm run prisma:seed
```

Expected seeded demo data:

- `client-001`, `client-002`, `client-003`
- one sample document for `client-001`
- onboarding progress for `client-001`
- CRM record `crm-client-001`
- data room `room-client-001`

Docker commands:

```bash
docker compose up -d postgres redis
docker compose ps
docker compose down
```

Optional Jaeger tracing:

```bash
docker compose --profile tracing up -d jaeger
```

Then set:

```bash
TRACING_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

Tracing uses OpenTelemetry HTTP, Express, and Prisma instrumentation in the gateway. Worker
consumers continue the originating trace from event metadata and emit processing spans.

Optional Grafana dashboards:

```bash
docker compose --profile observability up -d prometheus grafana
```

Grafana is available at `http://localhost:3000` and provisions `docker/grafana/dashboards/grafana-dashboard.json`.

Persistent event-driven flow:

```text
Frontend
↓
Gateway routes
↓
PostgreSQL insert/update through Prisma
↓
EventBus
↓
Redis/BullMQ
↓
Workers
↓
PostgreSQL worker-side updates through Prisma
```

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
- `/metrics` also exports error, auth failure, event publish/consume, worker processing, and Prisma query counters when observed by the process

## Storage

Document uploads keep the existing JSON API contract and also accept `multipart/form-data` with a `file` field. Supported file types are PDF, DOCX, PNG, JPG, and JPEG. Each `Document` row stores content type, byte size, SHA-256 checksum, bucket, key, storage URL, and provider metadata.

Local development:

```bash
STORAGE_PROVIDER=local
LOCAL_STORAGE_DIR=storage/documents
```

S3-compatible deployments:

```bash
STORAGE_PROVIDER=s3
S3_BUCKET=<bucket>
S3_REGION=<region>
S3_PREFIX=documents
```

The S3 provider stores the actual file bytes with `PutObject` and generates download URLs through `GET /api/onboarding/:clientId/documents/:documentId/download-url?expiresIn=900`. The route is RBAC-protected, validates document ownership by client/document ID, and writes an audit entry. Configure credentials through the runtime environment or platform identity.

## Alerting, Secrets, And Worker Metrics

Alerting is environment-configurable:

```bash
ALERT_PROVIDER=console
SLACK_WEBHOOK_URL=
```

Set `ALERT_PROVIDER=slack` with `SLACK_WEBHOOK_URL` to send alerts to Slack; console logging remains the fallback. Alerts cover Redis failures, database connectivity failures, worker job failures, DLQ growth, high error rate, and high latency.

Secret loading supports `SECRET_PROVIDER=env` and `SECRET_PROVIDER=aws`. For AWS Secrets Manager, set `AWS_SECRETS_REGION` and `AWS_SECRETS_JSON_ID`; the secret value should be a JSON object containing runtime environment keys. Startup validation checks required secret presence and never logs secret values.

Workers expose Prometheus metrics on `/metrics`. Default ports are `4101` for CRM, `4102` for data-room, and `4103` for onboarding, or set `WORKER_METRICS_PORT` explicitly.

## Backup And Restore

PostgreSQL backups use `pg_dump` custom format:

```bash
scripts/backup-db.sh
scripts/restore-db.sh backups/<file>.dump
```

Windows PowerShell:

```powershell
.\scripts\backup-db.ps1
.\scripts\restore-db.ps1 -BackupFile backups\<file>.dump
```

Disaster recovery validation against a disposable database:

```powershell
.\scripts\validate-dr.ps1 -DatabaseUrl "postgresql://postgres:postgres@localhost:5432/ai_platform_dr"
```

```bash
scripts/validate-dr.sh "postgresql://postgres:postgres@localhost:5432/ai_platform_dr"
```

Gateway and worker logs are structured JSON and include request IDs, correlation IDs, event IDs, service names, routes, and status fields where available.

## Testing

`npm run prisma:test:prepare` generates the SQLite-compatible Prisma test client. `npm test` runs gateway integration tests for:

- Missing, expired, and role-mismatched JWT handling
- Bcrypt login, password strength, refresh token rotation, and logout revocation
- Admin RBAC success path
- Redis-compatible rate limiting behavior
- Event route publishing for `document.uploaded`
- Frontend-facing auth, dashboard, client, onboarding, and chat route contracts
- JSON and multipart document upload plus local download URL generation
- Database-backed client, document, onboarding, CRM, and data-room state
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



## Implemented Features

### Frontend

✓ React + TypeScript Frontend
✓ Vite Development Environment
✓ Authentication & Login UI
✓ Dashboard UI
✓ Client Management Interface
✓ Onboarding Workflow Interface
✓ Document Upload Interface
✓ AI Chat Interface
✓ Frontend–Backend Integration

### Backend

✓ API Gateway Architecture
✓ Event-Driven Architecture
✓ JWT Authentication
✓ Role-Based Access Control (RBAC)
✓ Redis Integration
✓ BullMQ Queue Processing
✓ Client Creation Workflow
✓ Document Upload Workflow
✓ CRM Service Integration
✓ Data Room Provisioning
✓ Onboarding Progress Tracking
✓ Health Monitoring Endpoints
✓ OpenAPI Documentation
✓ Metrics & Observability

### Event Processing

✓ client.created Event Publishing
✓ document.uploaded Event Publishing
✓ CRM Worker Processing
✓ Data Room Worker Processing
✓ Onboarding Worker Processing
✓ Event-Based State Updates

### Quality Assurance

✓ Automated Integration Tests (16/16 Passed)
✓ TypeScript Build Validation
✓ End-to-End Integration Testing
✓ GitHub Repository Integration


## Team Members

- Himanshu Shekhar - API Gateway & Event System Engineer
- Pavithra - Onboarding Backend Engineer
- Mahika - AI Engineer
- Darshan - Frontend Developer (React UI Engineer)
- Rahul - Dashboard & Integration Engineer

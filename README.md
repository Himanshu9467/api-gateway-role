# AI Platform API Gateway & Event-Orchestration Backbone

This repository houses the production-grade, highly resilient API Gateway and asynchronous Event Backbone built for the AI Platform. It is engineered using TypeScript, Node.js, Express, and a custom Redis-backed BullMQ event pipeline to orchestrate complex onboarding and backend workflows.

## Purpose

The platform serves as the central traffic controller, API Gateway, and message broker for the onboarding ecosystem. It coordinates secure, high-throughput document ingestion, background OCR processing, compliance validation, manual/automated review flows, identity verification, and third-party CRM state synchronization across distributed microservices.

## Main Features

- **Decoupled Event Orchestration:** A transactional, custom-scheduled event pipeline passing messages between isolated worker threads.
- **Robust Security & RBAC:** Comprehensive JSON Web Token (JWT) management, identity federation (Cognito, Keycloak, Auth0), constant-time API key comparison, secure hashing of reset tokens, and refresh token rotation with family revocation.
- **Resilient Queue Processing:** Custom retry backoffs, automatic Dead Letter Queue (DLQ) redirection, dynamic replay routes, and distributed idempotency locking.
- **Production Hardening:** Managed connection pooling, configurable worker concurrency limits, safe signal handling (SIGINT/SIGTERM) with safety execution timeouts, and pre-boot environment validation checks.
- ** Observability & Diagnostics:** Live metrics endpoints exposing Prometheus gauges, tracing spans via OpenTelemetry, and structured JSON logs tagged with Correlation and Request IDs.

---

## Architecture Overview

The platform uses a decoupled, event-driven pattern where the API Gateway persists transactional records and dispatches messages to Redis/BullMQ queues. Isolated backend consumers (workers) pull from these queues, process tasks using specialized state services, and enqueue successor events.

```
       +---------------------------------------------+
       |             Vite React Frontend             |
       +---------------------------------------------+
                              | HTTP
                              v
       +---------------------------------------------+
       |        Express API Gateway (Port 4000)      |
       +---------------------------------------------+
          | Prisma Client              | Shared Client
          v                            v
  +---------------+            +---------------------+
  |  PostgreSQL   |            | RedisConnectionPool |
  +---------------+            +---------------------+
                                       |
                   +-------------------+-------------------+
                   | Shared Conn                           | Duplicated Worker Conn
                   v                                       v
         +--------------------+                  +--------------------+
         |   Queues & DLQs    |                  |  BullMQ Workers    |
         | (Enqueues Events)  |                  | (BRPOP / Polling)  |
         +--------------------+                  +--------------------+
```

### Event-Driven Onboarding Workflow

The complete end-to-end document onboarding chain follows this sequence:

```mermaid
graph TD
    Client[HTTP Client Upload] -->|POST /api/onboarding/.../upload| Gateway[API Gateway]
    Gateway -->|Publish| DocUploaded[document.uploaded]
    
    %% Event Pipeline Chaining
    DocUploaded -->|Consumer: ocr-service| OCRWorker[OCR Worker]
    OCRWorker -->|Extract & Publish| DocOcrComp[document.ocr.completed]
    
    DocOcrComp -->|Consumer: validation-service| ValWorker[Validation Worker]
    ValWorker -->|Validate & Publish| DocValComp[document.validation.completed]
    
    DocValComp -->|Consumer: review-service| RevWorker[Review Worker]
    
    RevWorker -->|Auto-Reject / Manual Reject| RevRej[review.rejected]
    RevWorker -->|Manual Assign| RevAss[review.assigned]
    RevWorker -->|Auto-Approved / Approved| RevApp[review.approved]
    
    RevApp -->|Consumer: face-verification-service| FaceWorker[Face Verification Worker]
    FaceWorker -->|Verify & Publish| FaceComp[face.verification.completed]
    
    FaceComp -->|Consumer: crm-sync-service| CRMWorker[CRM Sync Worker]
    CRMWorker -->|Sync Started| CrmStart[crm.sync.started]
    CRMWorker -->|Sync & Publish| CrmComp[crm.sync.completed]
    
    CrmComp -->|Consumer: kyc-service| KYCWorker[KYC Completion Worker]
    KYCWorker -->|Finalize & Publish| KycComp[kyc.completed]
```

---

## Features

### Security & Traffic Management
- **Authentication:** Standard JWT token issuance and validation, alongside dynamic JWKS certificate verification for identity federation (Cognito, Auth0, Keycloak).
- **RBAC Enforcement:** Route-level middleware checking user and service roles (`admin`, `user`, `service`).
- **Constant-Time Verification:** API Key checks are done using `crypto.timingSafeEqual` to avoid side-channel profiling.
- **Refresh Token Family Rotation:** Invalidation of entire session chains if refresh token reuse is detected.
- **Secure Token Hashing:** Reset and verification tokens are kept hashed (SHA-256) at rest, preventing database-compromise hijack loops.

### Processing & Worker Services
- **OCR Processing:** Evaluates document content and scores OCR confidence.
- **Document Validation:** Validates format, length, structural metadata, and field requirements.
- **Review Workflow:** Route-based manual approvals/rejections combined with an automated scoring engine.
- **Face Verification:** Mimics facial biometric authentication against uploaded identity cards.
- **CRM Synchronization:** Pushes state records to the customer database and locks IDs.
- **KYC Completion:** Triggers onboarding finalization and updates PostgreSQL tables.

### Reliability & Resiliency
- **Retry Logic:** Automatic retry handler with configurable intervals (`0ms → 5s → 15s → 30s`).
- **Dead Letter Queue (DLQ):** Failed jobs are sent to an isolated dead-letter queue after 5 failed attempts.
- **Event Replay:** Administrative endpoint allows replaying entries from the DLQ back to active workers.

### Diagnostics & Monitoring
- **Metrics Endpoint:** Exposes Prometheus gauges tracking backlog queues, active loads, and DLQ levels.
- **OpenAPI/Swagger:** Standard API blueprints are available at `/openapi.json`.
- **Tracing Spans:** OpenTelemetry spans map events across microservice boundaries.

---

## Project Structure

```text
api-gateway-project/
├── crm/                 # CRM downstream mock service
├── data-room/           # Data room downstream mock service
├── docs/                # Architectural, deployment, and operational docs
├── frontend/            # React + Vite client frontend UI
├── gateway/             # Express + TypeScript API Gateway
│   ├── src/
│   │   ├── __tests__/   # Integration tests
│   │   ├── auth/        # Auth0, Keycloak, Cognito handlers
│   │   ├── config/      # Environment variables & service registry configs
│   │   ├── docs/        # OpenAPI spec documentation
│   │   ├── examples/    # OCR, Validation, Review, Face, CRM, KYC consumers
│   │   ├── middleware/  # Auth, rate-limiter, logging, error-handling middlewares
│   │   ├── observability/# prometheus exporter & OpenTelemetry tracing bootstrap
│   │   ├── orchestrator/# Command parser & workflow engine
│   │   ├── routes/      # Gateway API controllers
│   │   ├── services/    # Health, database clients, and service registries
│   │   └── utils/       # Request ID decorators
├── onboarding/          # Onboarding downstream mock service
├── packages/
│   └── events/          # @ai-platform/events Redis/BullMQ monorepo package
├── prisma/              # Schema declarations, postgres migrations, SQLite test client
└── storage/             # Local upload storage directory
```

---

## Prerequisites

| Software | Version Required | Tested Version |
|---|---|---|
| **Node.js** | $\ge 20.0.0$ | v25.6.0 |
| **npm** | $\ge 10.0.0$ | v10.9.2 |
| **Redis** | $\ge 6.2$ | v7.2.4 (Alpine) |
| **PostgreSQL**| $\ge 14.0$ | v16.1 (Alpine) |

---

## Environment Variables

Copy `.env.example` to `.env` at the repository root. The entire monorepo uses this single environment file.

```ini
# Core Variables
NODE_ENV=development
PORT=4000
SERVICE_NAME=api-gateway

# Database & Persistent Storage
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_platform?schema=public

# Security Settings
JWT_SECRET=dev-only-change-this-secret
SERVICE_API_KEYS=crm-sync-service:api-key-crm,kyc-service:api-key-kyc,admin-service:api-key-admin

# Redis Configurations
REDIS_URL=redis://localhost:6379

# Worker Tuning (New)
WORKER_CONCURRENCY=5

# Downstream Mock Microservices
CRM_SERVICE_URL=http://localhost:3003
ONBOARDING_SERVICE_URL=http://localhost:3002
DATA_ROOM_SERVICE_URL=http://localhost:3001

# Storage Configurations
STORAGE_PROVIDER=local
LOCAL_STORAGE_DIR=storage/documents

# Observability
WORKER_METRICS_PORT=4100
TRACING_ENABLED=false
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

---

## Installation

Perform the following steps to bootstrap the workspace:

### 1. Clone & Install
```bash
git clone <repository-url>
cd api-gateway-project
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Spin up Core Containers
```bash
docker compose up -d postgres redis
```

### 4. Setup Database
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 5. Build Workspace
```bash
npm run build
```

---

## How to Run the Full Project

To run the full stack, start the gateway and consumer workers. Since they run concurrently, open separate terminal windows:

### Terminal 1: API Gateway
Starts the main Express gateway on port `4000`:
```bash
npm run dev:gateway
```

### Terminal 2: CRM & Onboarding Services Mocks
Starts downstream service mocks:
```bash
npm run mock:services
```

### Terminal 3: OCR Worker Consumer
```bash
npm run worker:ocr
```

### Terminal 4: Validation Worker Consumer
```bash
npm run worker:validation
```

### Terminal 5: Review Worker Consumer
```bash
npm run worker:review
```

### Terminal 6: Face Verification Worker Consumer
```bash
npm run worker:face-verification
```

### Terminal 7: CRM Sync Worker Consumer
```bash
npm run worker:crm-sync
```

### Terminal 8: KYC Worker Consumer
```bash
npm run worker:kyc
```

*(Note: The database-room, crm, and onboarding generic workers can be launched using `npm run worker:data-room`, `npm run worker:crm`, and `npm run worker:onboarding` if required.)*

---

## API Documentation

### Swagger & OpenAPI Spec
Available in JSON schema configuration:
- `GET http://localhost:4000/openapi.json`

### Health Endpoints
- **Gateway Health:** `GET /health`
- **Downstream Services Health:** `GET /health/services`
- **BullMQ Event Queue Health:** `GET /health/events`

### Metrics Exporter
- **Prometheus Metrics:** `GET /metrics`

### Core Routes Summary
- `POST /api/auth/login`: Issue local session tokens
- `POST /api/ocr/extract`: Submit document text extraction tasks
- `POST /api/validation/document`: Enqueue document audits
- `POST /api/review/approve` / `reject`: Enqueue manual decisions
- `POST /api/crm/sync`: Synchronize record profiles
- `POST /api/events/replay`: Force-replay failed jobs from DLQ

---

## Testing

Ensure SQLite schemas are initialized, then execute integration tests:

```bash
# Generate sqlite schemas
npm run prisma:test:prepare

# Run verification test runner
npm test
```

### Expected Results
```text
# tests 45
# suites 16
# pass 45
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 15175.3006
```

---

## Event System

- **Publishers:** Routes or orchestrators serialize payload models and write them to Redis event envelopes using `EventPublisher.publish()`.
- **Subscribers:** Bound to consumers via `EventSubscriber`. Each worker duplicates its Redis connection internally to isolate blocking polling actions.
- **Retry Strategy:** Backoff retry attempts occur at intervals: `Attempt 1 (Immediate) → Attempt 2 (0ms) → Attempt 3 (5s) → Attempt 4 (15s) → Attempt 5 (30s)`.
- **DLQ Redirection:** If a job fails the 5th attempt, it is removed from the active queue and moved to the dead letter queue (e.g. `events-document-uploaded-ocr-service-dlq`).
- **Replay System:** Replaying a job reads it from the DLQ, schedules it on the main queue with a replay prefix, and cleans up the dead letter record.

---

## Production Hardening

1.  **Shared Redis connection management:** Utilizes `RedisConnectionFactory.getSharedConnection()` to share a single connection across standard event buses, publishers, and routes, avoiding connection leaks.
2.  **Configurable worker concurrency:** Worker thread sizing is governed by `WORKER_CONCURRENCY` in the env file.
3.  **Graceful shutdown handling:** Listeners intercept shutdown signals (`SIGINT`/`SIGTERM`) and wait for active jobs to finish, with a 15-second safety force-quit timeout.
4.  **Environment validation:** Pre-boot schema parser audits configurations, logging issues to stderr and exiting immediately on validation failure.
5.  **Queue health monitoring:** Exposes real-time backlog counts under Prometheus indicators in the gateway's `/metrics` response.

---

## Deployment

1.  **Build Phase:** Compile packages/events first, then build gateway distribution folders:
    ```bash
    npm run build
    ```
2.  **Migration Phase:** Run deployment-style migrations inside target environments:
    ```bash
    npm run prisma:deploy
    ```
3.  **Startup Sequence:** 
    - Verify PostgreSQL and Redis instance health checks.
    - Run migrations (`prisma:deploy`).
    - Start Downstream mock services.
    - Start API Gateway (`npm run start` or `node dist/index.js`).
    - Launch individual worker processes.
4.  **Health Verification:** Query `/health/services` and `/health/events` to ensure target subsystems are reachable.

---

## Troubleshooting

### Redis Connection Failures
- **Symptom:** Gateway or workers refuse to boot up, outputting connection timeout alerts.
- **Fix:** Ensure Redis container port `6379` is open. Test using `redis-cli ping` or verify network firewalls.

### Prisma Migration Lockups
- **Symptom:** Migration execution hangs on deployment start.
- **Fix:** Terminate stale DB client connections. Confirm postgres user permissions are sufficient to modify schemas.

### JWT Verification Failures
- **Symptom:** Valid requests fail with `token_expired` or `unauthorized` errors.
- **Fix:** Check system clock synchronization (drift will invalidate tokens). Ensure `JWT_SECRET` matches across gateway deployments.

### Queue Backlog Growths
- **Symptom:** Prometheus gauges show `gateway_worker_queue_waiting` growing.
- **Fix:** Scaling issue. Increase worker node counts, or raise the `WORKER_CONCURRENCY` parameter.

---

## Team Members

- Himanshu Shekhar - API Gateway & Event System Engineer
- Pavithra - Onboarding Backend Engineer
- Mahika - AI Engineer
- Darshan - Frontend Developer (React UI Engineer)
- Rahul - Dashboard & Integration Engineer

---

## Production Readiness Status

- [x] TypeScript Build Passing
- [x] 45/45 Tests Passing
- [x] 16/16 Test Suites Passing
- [x] Event Pipeline Verified
- [x] Production Hardening Complete

**Status:** **PRODUCTION READY**

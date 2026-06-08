# Operations & Deployment Manual

This document provides deployment guidelines and operations runbooks for the API Gateway and Event-driven system.

---

## 1. Environment Configurations (Startup Checklist)

The system automatically validates required configurations on start. Ensure the following environment variables are exported:

### Core Configuration
- `NODE_ENV`: Application mode (`development`, `test`, `production`).
- `PORT`: Port for Express API gateway (default: `4000`).
- `JWT_SECRET`: Secret of at least 32 characters (strictly enforced in `production`).
- `REDIS_URL`: Redis server URL (e.g. `redis://localhost:6379`). Must be set in `production`.
- `DATABASE_URL`: PostgreSQL connection string. Must be set in `production`.

### Scaling & Concurrency (New)
- `WORKER_CONCURRENCY`: Number of concurrent jobs processed by each worker consumer (default: `5`).
  - *Tuning Recommendation:* For CPU-bound tasks like OCR validation, keep concurrency low (`2-4` per core). For network/DB bound tasks like CRM sync, keep it high (`10-20`).

### Storage Configuration
- `STORAGE_PROVIDER`: Either `local` or `s3`.
- `LOCAL_STORAGE_DIR`: Directory path if provider is `local`.
- `S3_BUCKET` & `S3_REGION`: Required if provider is `s3`.

---

## 2. Queue Health Metrics Reference

The Prometheus endpoint at `/metrics` exposes real-time queue states directly from Redis. Monitor the following Gauges:

- `gateway_worker_queue_waiting`: Number of jobs waiting in the queue to be processed by workers. High numbers indicate worker starvation.
- `gateway_worker_queue_active`: Number of jobs currently being processed.
- `gateway_worker_queue_failed`: Number of jobs that have failed but might still have attempts left.
- `gateway_worker_dlq_count`: Number of jobs that failed all 5 attempts and are sitting in the Dead Letter Queue (DLQ). **This should always trigger alerts if > 0.**

---

## 3. Graceful Shutdown & Deployments

When redeploying or rolling out updates, the gateway process handles SIGINT and SIGTERM gracefully:
- Stops accepting new API requests.
- Waits for active worker consumers to finish processing their current jobs.
- Cleans up connections cleanly using the connection pool.
- Automatically force-exits after **15 seconds** to prevent deployment pipeline hangs if any task locks up.

---

## 4. DLQ Management & Job Replay

If a job fails all 5 attempts (incorporating custom backoff delays `0ms → 5s → 15s → 30s`), it is placed in the DLQ to prevent blocking the main pipeline. 

### How to Replay a Failed Job:
Make a POST request to `/api/events/replay` with the service API key or admin bearer token:

```bash
curl -X POST http://localhost:4000/api/events/replay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "eventName": "document.uploaded",
    "consumerName": "ocr-service",
    "jobId": "event-abc123-ocr-service"
  }'
```

**What happens under the hood:**
1. The queue manager retrieves the raw job details from the Dead Letter Queue.
2. Creates a new job under `document.uploaded.replay` in the main queue to attempt processing again.
3. Automatically deletes the old failed entry from the DLQ.
4. Generates an audit log recording the replay event action.

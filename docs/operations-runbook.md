# Operations Runbook

## Startup

1. Confirm secrets are present: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, and provider-specific settings.
2. Start dependencies: PostgreSQL, Redis, and optional Prometheus/Grafana/Jaeger.
3. Apply migrations: `npm run prisma:deploy`.
4. Start gateway and workers.
5. Verify `/health`, `/health/events`, `/metrics`, and a login smoke test.

## Shutdown

1. Stop ingress or remove the node from the load balancer.
2. Send `SIGTERM` to gateway and workers.
3. Wait for in-flight HTTP requests and worker jobs to drain.
4. Stop Redis and PostgreSQL only after application processes exit.

## Rollback

1. Keep the previous container image available.
2. Stop new traffic.
3. Deploy the previous image.
4. Do not roll back database migrations unless a tested down migration or restore point exists.
5. Verify auth, client creation, upload, queue processing, and audit log reads.

## Backup

Use the existing scripts:

```bash
scripts/backup-db.sh
```

PowerShell:

```powershell
.\scripts\backup-db.ps1
```

Schedule daily backups and retain at least 7 daily, 4 weekly, and 3 monthly copies.

## Restore

Restore into a disposable database first:

```bash
scripts/restore-db.sh backups/<file>.dump
```

Then run:

```bash
scripts/validate-dr.sh "postgresql://postgres:postgres@localhost:5432/ai_platform_dr"
```

## Incident Response

1. Classify severity by customer impact, data exposure, and duration.
2. Preserve logs, audit records, traces, and queue state.
3. Rotate exposed secrets immediately.
4. Disable affected service API keys or users.
5. Publish status updates and a post-incident review.

## Worker Recovery

1. Check `/health/events` for waiting, failed, and DLQ counts.
2. Restart only the affected worker when possible.
3. Re-drive DLQ messages after confirming idempotency keys and root cause.
4. Watch `gateway_worker_jobs_total`, queue depth, and DLQ depth in Grafana.

## Redis Recovery

1. Confirm Redis persistence and disk availability.
2. Restart Redis with append-only file enabled.
3. Restart workers after Redis is healthy.
4. Confirm queue statistics and event publishing.

## PostgreSQL Recovery

1. Stop gateway and workers to prevent partial writes.
2. Restore the last known good backup.
3. Apply migrations.
4. Run DR validation.
5. Restart gateway, then workers.

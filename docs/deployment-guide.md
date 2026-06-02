# Deployment Guide

## Docker Compose Production

1. Copy `.env.example` to `.env`.
2. Set strong values for `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `SERVICE_API_KEYS`, and email/storage providers.
3. Start dependencies and observability:

```bash
docker compose --profile observability up -d
```

4. Apply migrations:

```bash
npm run prisma:deploy
```

5. Verify `/health`, `/metrics`, login, refresh, upload, and worker processing.

## Single VPS

- Run Docker Engine and Compose.
- Put Nginx or Caddy in front of the gateway with HTTPS.
- Store `.env` outside source control with `0600` permissions.
- Use daily PostgreSQL backups and ship them off-host.
- Keep Redis append-only persistence enabled.
- Restart policy: `unless-stopped`.
- Monitor disk, CPU, memory, PostgreSQL connections, Redis memory, queue depth, DLQ depth, and 5xx rate.

## AWS ECS

- Build and push the gateway image to ECR.
- Use ECS Fargate services for gateway and workers.
- Use RDS PostgreSQL and ElastiCache Redis.
- Use AWS Secrets Manager for `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, service API keys, and SMTP/SES secrets.
- Use task roles for S3 and Secrets Manager access.
- Put the gateway behind an ALB with HTTPS.
- Configure autoscaling on CPU, request rate, and queue depth.
- Send logs to CloudWatch and scrape metrics with Prometheus-compatible tooling.

## Environment Variables

Required production variables:

- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `SERVICE_API_KEYS`
- `EMAIL_PROVIDER`
- `APP_BASE_URL`
- `STORAGE_PROVIDER`

Provider variables:

- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`
- SES: `SES_REGION`, `EMAIL_FROM`
- S3: `S3_BUCKET`, `S3_REGION`, `S3_PREFIX`
- AWS secrets: `SECRET_PROVIDER=aws`, `AWS_SECRETS_REGION`, `AWS_SECRETS_JSON_ID`

## Secrets Management

- Prefer managed secret stores.
- Rotate `JWT_SECRET`, service API keys, SMTP credentials, and AWS credentials on incident.
- Never log secret values.
- Use IAM roles instead of static AWS keys.

## Monitoring Setup

- Start Prometheus and Grafana with the observability Compose profile.
- Import or provision `docker/grafana/dashboards/grafana-dashboard.json`.
- Alert on high 5xx rate, auth failures, password reset spikes, DLQ growth, Redis failure, database failure, and S3 startup failure.

## Backup Schedule

- Daily PostgreSQL custom-format dump.
- Weekly restore validation.
- Retain at least 7 daily, 4 weekly, and 3 monthly backups.
- Store backups encrypted and off-host.

## Scaling Guidance

- Scale gateway horizontally behind a load balancer.
- Scale workers independently by queue depth.
- Keep Redis and PostgreSQL managed or vertically sized before heavy horizontal growth.
- Use short JWT TTL and refresh-token rotation consistently across all instances.

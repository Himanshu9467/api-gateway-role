# Threat Model

## Assets

- User credentials and refresh tokens
- JWT signing secret
- Client, document, CRM, onboarding, and audit data
- S3 document objects and presigned URLs
- Redis queues and DLQs
- PostgreSQL backups

## Actors

- Anonymous internet user
- Authenticated user
- Admin user
- Service account
- Compromised dependency or runtime
- Cloud principal with excessive permissions

## Primary Threats

- Credential stuffing and password spraying
- Account enumeration through recovery flows
- Refresh token replay
- Password reset token theft or replay
- Unverified account abuse
- RBAC bypass
- Malicious file upload
- Presigned URL leakage
- S3 bucket misconfiguration
- Queue poisoning or duplicate event processing
- Secret leakage in logs or traces
- Backup theft

## Mitigations

- Rate limiting and enumeration-safe responses for auth recovery endpoints
- Hashed, expiring, one-time reset and verification tokens
- Refresh token rotation with family tracking and revocation
- RBAC middleware and service API key separation
- File type allow-list and size limits for uploads
- S3 prefix-scoped IAM and private objects
- Idempotency and DLQ handling in event processing
- Structured audit logs for sensitive actions
- Startup secret validation and production secret strength checks
- Operational runbook and DR scripts

## Residual Risks

- Frontend verification gating still needs product-level rollout decisions.
- S3 startup validation avoids test writes, so live upload validation remains an operational step.
- Broad CORS remains acceptable for local development but should be restricted for production domains.

## Cloud Threat Model Update

| Threat | Mitigation |
| --- | --- |
| Secret disclosure | Secrets Manager, KMS encryption, no secret logging, task-role scoped access |
| Public database exposure | RDS in private subnets, ECS-only security group ingress |
| Redis lateral movement | Private subnet placement, ECS-only ingress, encryption in transit and at rest |
| Object storage exposure | S3 public access block, least-privilege task role, versioning, KMS encryption |
| Compromised task role | Narrow IAM resources, CloudTrail auditing, no wildcard admin policies |
| Gateway DoS | ALB health checks, ECS autoscaling, rate limiting, WAF rate-based recommendation |
| Bad deploy | ECS rolling deployment, health checks, rollback scripts, production environment approval |
| Regional outage | Cross-region backups, S3 replication, Secrets replication, Route 53 failover runbook |

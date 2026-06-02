# Security Hardening

Implemented controls:

- JWT access tokens use HS256 and short TTL.
- Refresh tokens are opaque, hashed at rest, rotated, and revocable.
- Passwords are bcrypt-hashed with strength validation.
- Password reset tokens are random, hashed at rest, expiring, single-use, and revoke active refresh tokens after reset.
- Email verification tokens are random, hashed at rest, expiring, and single-use.
- Forgot-password and resend-verification responses are enumeration-resistant.
- Sensitive auth recovery endpoints have additional rate limiting.
- RBAC protects gateway, proxy, event, dashboard, onboarding, and audit routes.
- Audit logging records auth, reset, verification, upload, download, and worker-side actions.
- S3 access is prefix-scoped and startup-validated when enabled.
- Secrets are validated at startup and can load from environment or AWS Secrets Manager.
- Prometheus metrics and OpenTelemetry tracing support production investigation.

Recommended production settings:

- Use a 32+ byte random `JWT_SECRET` from a secret manager.
- Use managed PostgreSQL with TLS, backups, and point-in-time recovery.
- Use managed Redis with persistence and TLS where available.
- Use workload identity for AWS credentials; do not store static access keys in `.env`.
- Enforce HTTPS at the ingress layer.
- Set strict CORS origins instead of broad development CORS.
- Configure SMTP or SES with SPF, DKIM, and DMARC.
- Enable S3 default encryption and block public access.
- Alert on auth failures, password reset spikes, DLQ growth, and elevated 5xx rates.

Residual risks:

- JWT signing is symmetric; compromise of `JWT_SECRET` allows token forgery until rotated.
- SES provider is environment-selected, but full signed SES API delivery should be validated with production credentials before launch.
- Email verification is implemented, but existing frontend routes are not contract-changed to block all business actions for unverified users.
- Startup S3 validation is non-mutating, so it does not prove `PutObject` by creating a probe object.

Enterprise cloud additions:

- AWS Secrets Manager is the production secret source through `SECRET_PROVIDER=aws`.
- KMS customer-managed key rotation is enabled for application secrets, S3, ECR image encryption, CloudWatch logs, RDS, and Redis where supported.
- RDS PostgreSQL is encrypted, Multi-AZ, private-subnet only, and reachable only from the ECS task security group.
- ElastiCache Redis is encrypted at rest and in transit, Multi-AZ, and reachable only from ECS tasks.
- S3 document storage is private, versioned, encrypted, public-access blocked, and replication-ready.
- ECS task roles are scoped to the application secret, KMS key, and document bucket.
- ALB is the only public ingress point. Gateway and worker tasks run in private subnets.
- Recommended WAF controls: AWS managed common rules, known bad inputs, SQLi/XSS protections, IP reputation, body-size limits for upload routes, and rate-based auth rules.

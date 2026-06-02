# Multi-Region Architecture

```mermaid
flowchart LR
  Users[Users] --> DNS[Route 53 health checks and failover]
  DNS --> Primary[Primary Region ECS and ALB]
  DNS -. failover .-> Secondary[Secondary Region ECS and ALB]
  Primary --> RDS1[(Multi-AZ PostgreSQL)]
  Primary --> Redis1[(Multi-AZ Redis)]
  Primary --> S3A[(S3 Documents)]
  Secondary --> RDS2[(Restored or read replica PostgreSQL)]
  Secondary --> Redis2[(Warm Redis)]
  Secondary --> S3B[(Replicated S3 Documents)]
  S3A --> S3B
  Primary --> SecretsA[Secrets Manager]
  SecretsA --> SecretsB[Replicated Secrets]
  RDS1 --> Backups[Cross-region snapshots]
  Backups --> DR[Disaster Recovery Region]
```

## Regions

- Primary region: active production traffic
- Secondary region: warm standby with replicated storage and deployable ECS services
- Disaster recovery region: backup restore target and incident validation region

## Replication

- RDS: automated backups, manual snapshots copied cross-region, optional read replica for tighter RPO
- S3: versioned bucket with cross-region replication
- Secrets Manager: replicated secrets per region with KMS keys
- Container images: ECR replication or CI push to each regional registry
- DNS: Route 53 health checks with failover records

## Recovery Procedure

1. Declare incident and freeze nonessential deployments.
2. Verify primary ALB, ECS, RDS, Redis, and S3 health.
3. Promote secondary database replica or restore latest copied snapshot.
4. Update regional Secrets Manager values for `DATABASE_URL` and `REDIS_URL`.
5. Scale secondary ECS services to production desired counts.
6. Run Prisma migration status and gateway `/health`.
7. Shift Route 53 failover to secondary.
8. Validate auth, document upload, worker processing, metrics, and audit logging.

## Runbooks

- Backup validation: `scripts/validate-dr.sh` or `scripts/validate-dr.ps1`
- Database restore: `scripts/restore-db.sh` or `scripts/restore-db.ps1`
- ECS deployment: `scripts/deploy-prod.sh` or `scripts/deploy-prod.ps1`

# Terraform Infrastructure

This directory deploys the platform on AWS with reusable modules for network, ALB, ECS, PostgreSQL, Redis, S3, monitoring, and secrets.

## Environments

- `environments/dev`
- `environments/staging`
- `environments/prod`

Each environment expects AWS credentials with permission to create VPC, ECS, ECR, RDS, ElastiCache, S3, KMS, Secrets Manager, IAM, ALB, and CloudWatch resources.

## Commands

```bash
cd infrastructure/terraform/environments/prod
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
terraform destroy
```

Use `TF_VAR_db_password` and `TF_VAR_image_tag` in CI/CD rather than committing secrets.

## Cloud Resources

- VPC with public and private subnets across two AZs
- Internet gateway and NAT gateway
- Public ALB with blue and green target groups
- ECS Fargate cluster and four services: gateway, CRM worker, onboarding worker, data-room worker
- ECR repositories for all four deployable images
- Multi-AZ encrypted RDS PostgreSQL
- Multi-AZ encrypted ElastiCache Redis replication group
- Versioned, encrypted, private S3 bucket
- KMS key with rotation
- Secrets Manager application secret
- CloudWatch log groups, alarm, and dashboard

## Secrets

Populate the Secrets Manager JSON secret after apply:

```json
{
  "DATABASE_URL": "postgresql://platform_admin:<password>@<rds-endpoint>:5432/ai_platform?schema=public",
  "REDIS_URL": "rediss://<redis-primary-endpoint>:6379",
  "JWT_SECRET": "<32+ character secret>",
  "SERVICE_API_KEYS": "crm-service:<key>,onboarding-service:<key>,data-room-service:<key>"
}
```

## Notes

Production uses deletion protection and longer backups. Dev creates a placeholder secret to simplify first bootstrap, but the placeholder must be replaced before running real traffic.

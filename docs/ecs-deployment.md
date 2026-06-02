# ECS Deployment Automation

Production deployment is handled by:

- `scripts/deploy-prod.sh`
- `scripts/deploy-prod.ps1`

The scripts build and push four ECR images:

- `gateway`
- `crm-worker`
- `onboarding-worker`
- `data-room-worker`

They then run Prisma migrations in an ECS Fargate task, force rolling service deployments, wait for service stability, run the optional `/health` check, and roll back the gateway service to the previous task definition if deployment fails.

## Required Environment

- `AWS_REGION`
- `ENVIRONMENT=prod`
- `PROJECT=ai-platform`
- `IMAGE_TAG`
- `ECS_SUBNET_IDS`
- `ECS_SECURITY_GROUP_IDS`
- `HEALTH_URL`

## Blue/Green

Terraform creates blue and green target groups for the gateway ALB path. The default service attaches to blue. A production CodeDeploy extension can shift traffic between those target groups using the listener ARN and target group ARNs exported by the ALB module.

## Health Checks

- Gateway container: `GET /health`
- ALB target group: `GET /health`
- Service stabilization: `aws ecs wait services-stable`
- Worker redundancy: desired count greater than one in all environments

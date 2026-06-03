# GitHub Actions Secrets and Variables

## Required Secrets

Configure these as environment secrets for `dev`, `staging`, and `prod`.

| Name | Purpose |
| --- | --- |
| `AWS_ROLE_ARN` | IAM role assumed by GitHub Actions through OIDC for Terraform and ECS deployment. |
| `DB_PASSWORD` | PostgreSQL password passed to Terraform as `TF_VAR_db_password`. |

## Required Variables

Configure these as environment variables for `dev`, `staging`, and `prod`.

| Name | Purpose |
| --- | --- |
| `AWS_REGION` | AWS region used by Terraform, ECR, and ECS. |
| `ECS_SUBNET_IDS` | Comma-separated subnet IDs used by the migration Fargate task. |
| `ECS_SECURITY_GROUP_IDS` | Comma-separated security group IDs used by the migration Fargate task. |
| `HEALTH_URL` | Base URL checked after deployment. |

## Setup

1. In GitHub, open the repository settings.
2. Create environments named `dev`, `staging`, and `prod`.
3. Add the required secrets to each environment.
4. Add the required variables to each environment.
5. Ensure the `AWS_ROLE_ARN` trust policy allows GitHub OIDC for this repository and environment.

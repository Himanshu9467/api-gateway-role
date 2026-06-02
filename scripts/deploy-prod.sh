#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
PROJECT="${PROJECT:-ai-platform}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
CLUSTER="${CLUSTER:-${PROJECT}-${ENVIRONMENT}-cluster}"
SERVICES=("gateway" "crm-worker" "onboarding-worker" "data-room-worker")

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "$1 is required"; exit 1; }
}

require aws
require docker

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"

for service in "${SERVICES[@]}"; do
  repo="${PROJECT}-${ENVIRONMENT}/${service}"
  image="${REGISTRY}/${repo}:${IMAGE_TAG}"
  docker build -f gateway/Dockerfile -t "$image" .
  docker push "$image"
done

previous_gateway_task="$(aws ecs describe-services --region "$AWS_REGION" --cluster "$CLUSTER" --services "${PROJECT}-${ENVIRONMENT}-gateway" --query 'services[0].taskDefinition' --output text)"

run_migration_task() {
  task_def="$1"
  subnet_ids="${ECS_SUBNET_IDS:?ECS_SUBNET_IDS is required}"
  sg_ids="${ECS_SECURITY_GROUP_IDS:?ECS_SECURITY_GROUP_IDS is required}"
  task_arn="$(aws ecs run-task --region "$AWS_REGION" --cluster "$CLUSTER" --launch-type FARGATE --task-definition "$task_def" --network-configuration "awsvpcConfiguration={subnets=[$subnet_ids],securityGroups=[$sg_ids],assignPublicIp=DISABLED}" --overrides '{"containerOverrides":[{"name":"gateway","command":["npm","run","prisma:deploy"]}]}' --query 'tasks[0].taskArn' --output text)"
  aws ecs wait tasks-stopped --region "$AWS_REGION" --cluster "$CLUSTER" --tasks "$task_arn"
  exit_code="$(aws ecs describe-tasks --region "$AWS_REGION" --cluster "$CLUSTER" --tasks "$task_arn" --query 'tasks[0].containers[0].exitCode' --output text)"
  test "$exit_code" = "0"
}

rollback() {
  echo "Deployment failed; rolling gateway back to $previous_gateway_task"
  aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER" --service "${PROJECT}-${ENVIRONMENT}-gateway" --task-definition "$previous_gateway_task" >/dev/null
  aws ecs wait services-stable --region "$AWS_REGION" --cluster "$CLUSTER" --services "${PROJECT}-${ENVIRONMENT}-gateway"
}

trap rollback ERR

run_migration_task "$previous_gateway_task"

for service in "${SERVICES[@]}"; do
  aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER" --service "${PROJECT}-${ENVIRONMENT}-${service}" --force-new-deployment >/dev/null
done

for service in "${SERVICES[@]}"; do
  aws ecs wait services-stable --region "$AWS_REGION" --cluster "$CLUSTER" --services "${PROJECT}-${ENVIRONMENT}-${service}"
done

if [ -n "${HEALTH_URL:-}" ]; then
  curl -fsS "$HEALTH_URL/health" >/dev/null
fi

trap - ERR
echo "Production deployment completed for image tag ${IMAGE_TAG}"

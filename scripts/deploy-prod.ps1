param(
  [string]$AwsRegion = $env:AWS_REGION,
  [string]$Environment = "prod",
  [string]$Project = "ai-platform",
  [string]$ImageTag = "",
  [string]$HealthUrl = $env:HEALTH_URL
)

$ErrorActionPreference = "Stop"
if (-not $AwsRegion) { $AwsRegion = "us-east-1" }
if (-not $ImageTag) { $ImageTag = (git rev-parse --short HEAD).Trim() }

$services = @("gateway", "crm-worker", "onboarding-worker", "data-room-worker")
$cluster = "$Project-$Environment-cluster"
$accountId = (aws sts get-caller-identity --query Account --output text).Trim()
$registry = "$accountId.dkr.ecr.$AwsRegion.amazonaws.com"
aws ecr get-login-password --region $AwsRegion | docker login --username AWS --password-stdin $registry

foreach ($service in $services) {
  $repo = "$Project-$Environment/$service"
  $image = "$registry/$repo`:$ImageTag"
  docker build -f gateway/Dockerfile -t $image .
  docker push $image
}

$gatewayService = "$Project-$Environment-gateway"
$previousTask = (aws ecs describe-services --region $AwsRegion --cluster $cluster --services $gatewayService --query "services[0].taskDefinition" --output text).Trim()

function Rollback {
  Write-Host "Deployment failed; rolling gateway back to $previousTask"
  aws ecs update-service --region $AwsRegion --cluster $cluster --service $gatewayService --task-definition $previousTask | Out-Null
  aws ecs wait services-stable --region $AwsRegion --cluster $cluster --services $gatewayService
}

try {
  if (-not $env:ECS_SUBNET_IDS -or -not $env:ECS_SECURITY_GROUP_IDS) {
    throw "ECS_SUBNET_IDS and ECS_SECURITY_GROUP_IDS are required for migration task networking."
  }

  $network = "awsvpcConfiguration={subnets=[$env:ECS_SUBNET_IDS],securityGroups=[$env:ECS_SECURITY_GROUP_IDS],assignPublicIp=DISABLED}"
  $overrides = '{"containerOverrides":[{"name":"gateway","command":["npm","run","prisma:deploy"]}]}'
  $taskArn = (aws ecs run-task --region $AwsRegion --cluster $cluster --launch-type FARGATE --task-definition $previousTask --network-configuration $network --overrides $overrides --query "tasks[0].taskArn" --output text).Trim()
  aws ecs wait tasks-stopped --region $AwsRegion --cluster $cluster --tasks $taskArn
  $exitCode = (aws ecs describe-tasks --region $AwsRegion --cluster $cluster --tasks $taskArn --query "tasks[0].containers[0].exitCode" --output text).Trim()
  if ($exitCode -ne "0") { throw "Migration task failed with exit code $exitCode" }

  foreach ($service in $services) {
    aws ecs update-service --region $AwsRegion --cluster $cluster --service "$Project-$Environment-$service" --force-new-deployment | Out-Null
  }
  foreach ($service in $services) {
    aws ecs wait services-stable --region $AwsRegion --cluster $cluster --services "$Project-$Environment-$service"
  }
  if ($HealthUrl) { Invoke-WebRequest -UseBasicParsing "$HealthUrl/health" | Out-Null }
  Write-Host "Production deployment completed for image tag $ImageTag"
} catch {
  Rollback
  throw
}

# High Availability Architecture

## Implemented

- Multi-AZ VPC subnets
- NAT-backed private workloads
- Load-balanced gateway on ECS Fargate
- Gateway desired count of at least two
- Worker redundancy across CRM, onboarding, and data-room consumers
- ECS service autoscaling
- Gateway container health checks
- ALB target health checks
- Multi-AZ RDS PostgreSQL
- Multi-AZ ElastiCache Redis with automatic failover
- CloudWatch logs, dashboard, and high 5xx alarm

## Probes

- Liveness: gateway container `GET /health`
- Readiness: ALB target group `GET /health`
- Dependency health: `GET /health/services` and `GET /health/events`

## Failover

RDS and Redis fail over inside AWS managed Multi-AZ control planes. ECS services replace unhealthy tasks and continue processing worker queues with redundant consumers.

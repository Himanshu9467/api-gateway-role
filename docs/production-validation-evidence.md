# Production Validation Evidence

Local validation performed in this workspace should be recorded here before promotion.

| Check | Evidence |
| --- | --- |
| Terraform validate | Run `terraform init -backend=false && terraform validate` in each environment |
| ECS deployment | Run `scripts/deploy-prod.sh` or `scripts/deploy-prod.ps1` with AWS env vars |
| Identity federation | Configure provider and call `POST /api/auth/federated-login` |
| Secrets retrieval | Set `SECRET_PROVIDER=aws` and verify gateway startup without secret logging |
| CloudWatch logging | Confirm `/ecs/<env>/<service>` log streams receive gateway and worker JSON logs |
| Grafana metrics | Confirm `/metrics` scrape and dashboard panels populate |
| Worker failover | Stop one worker task and confirm ECS replacement plus queue progress |
| Multi-AZ failover | Reboot RDS with failover and verify gateway recovery |
| Backup restore | Run restore into disposable database and `scripts/validate-dr.*` |
| Disaster recovery | Execute multi-region runbook in a non-prod region |

output "cluster_name" { value = aws_ecs_cluster.this.name }
output "service_names" { value = { for key, service in aws_ecs_service.services : key => service.name } }
output "ecs_security_group_id" { value = aws_security_group.ecs.id }
output "ecr_repositories" { value = { for key, repo in aws_ecr_repository.images : key => repo.repository_url } }

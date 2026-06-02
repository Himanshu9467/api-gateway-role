output "alb_dns_name" { value = module.alb.alb_dns_name }
output "ecs_cluster_name" { value = module.ecs.cluster_name }
output "ecs_services" { value = module.ecs.service_names }
output "ecr_repositories" { value = module.ecs.ecr_repositories }
output "secret_name" { value = module.secrets.secret_name }
output "s3_bucket" { value = module.s3.bucket_name }

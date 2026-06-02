output "log_group_names" { value = [for group in aws_cloudwatch_log_group.services : group.name] }

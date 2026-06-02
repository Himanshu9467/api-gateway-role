resource "aws_cloudwatch_log_group" "services" {
  for_each          = toset(var.log_group_names)
  name              = "/ecs/${var.name}/${each.value}"
  retention_in_days = var.retention_days
  kms_key_id        = var.kms_key_arn
  tags              = var.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.name}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "High target 5xx count on the platform ALB"
  dimensions          = var.alb_metric_dimensions
  tags                = var.tags
}

resource "aws_cloudwatch_dashboard" "this" {
  dashboard_name = "${var.name}-platform"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        width  = 24
        height = 2
        properties = {
          markdown = "# ${var.name} platform\nECS, ALB, RDS, Redis, worker, and gateway health dashboard."
        }
      }
    ]
  })
}

resource "aws_kms_key" "this" {
  description             = "${var.name} application secrets and data encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                    = var.tags
}

resource "aws_kms_alias" "this" {
  name          = "alias/${var.name}-app"
  target_key_id = aws_kms_key.this.key_id
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name}/app"
  kms_key_id              = aws_kms_key.this.arn
  recovery_window_in_days = var.recovery_window_in_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "placeholder" {
  count         = var.create_placeholder_secret ? 1 : 0
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(var.placeholder_secret)
}

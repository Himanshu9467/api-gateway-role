locals {
  name = "${var.project}-${var.environment}"
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
  common_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = "4000" },
    { name = "SECRET_PROVIDER", value = "aws" },
    { name = "AWS_SECRETS_REGION", value = var.aws_region },
    { name = "AWS_SECRETS_JSON_ID", value = module.secrets.secret_name },
    { name = "STORAGE_PROVIDER", value = "s3" },
    { name = "S3_BUCKET", value = module.s3.bucket_name },
    { name = "S3_REGION", value = var.aws_region },
    { name = "TRACING_ENABLED", value = "true" }
  ]
  service_images = {
    gateway = {
      repository_name = "${local.name}/gateway"
      image_tag       = var.image_tag
      command         = ["node", "gateway/dist/index.js"]
      cpu             = 512
      memory          = 1024
      desired_count   = 2
      min_count       = 2
      max_count       = 4
      environment     = []
    }
    crm-worker = {
      repository_name = "${local.name}/crm-worker"
      image_tag       = var.image_tag
      command         = ["node", "gateway/dist/examples/crm.consumer.js"]
      cpu             = 256
      memory          = 512
      desired_count   = 2
      min_count       = 1
      max_count       = 4
      environment     = [{ name = "WORKER_METRICS_PORT", value = "4101" }]
    }
    onboarding-worker = {
      repository_name = "${local.name}/onboarding-worker"
      image_tag       = var.image_tag
      command         = ["node", "gateway/dist/examples/onboarding.consumer.js"]
      cpu             = 256
      memory          = 512
      desired_count   = 2
      min_count       = 1
      max_count       = 4
      environment     = [{ name = "WORKER_METRICS_PORT", value = "4103" }]
    }
    data-room-worker = {
      repository_name = "${local.name}/data-room-worker"
      image_tag       = var.image_tag
      command         = ["node", "gateway/dist/examples/dataRoom.consumer.js"]
      cpu             = 256
      memory          = 512
      desired_count   = 2
      min_count       = 1
      max_count       = 4
      environment     = [{ name = "WORKER_METRICS_PORT", value = "4102" }]
    }
  }
}

module "network" {
  source             = "../../modules/network"
  name               = local.name
  vpc_cidr           = "10.20.0.0/16"
  enable_nat_gateway = true
  public_subnets = {
    a = { cidr = "10.20.0.0/24", az = "${var.aws_region}a" }
    b = { cidr = "10.20.1.0/24", az = "${var.aws_region}b" }
  }
  private_subnets = {
    a = { cidr = "10.20.10.0/24", az = "${var.aws_region}a" }
    b = { cidr = "10.20.11.0/24", az = "${var.aws_region}b" }
  }
  tags = local.tags
}

module "secrets" {
  source                    = "../../modules/secrets"
  name                      = local.name
  create_placeholder_secret = true
  placeholder_secret = {
    DATABASE_URL     = "postgresql://platform_admin:${var.db_password}@pending:5432/ai_platform?schema=public"
    REDIS_URL        = "rediss://pending:6379"
    JWT_SECRET       = "replace-this-with-a-32-character-minimum-secret"
    SERVICE_API_KEYS = "crm-service:replace,onboarding-service:replace,data-room-service:replace"
  }
  tags = local.tags
}

module "s3" {
  source      = "../../modules/s3"
  bucket_name = "${local.name}-documents"
  kms_key_arn = module.secrets.kms_key_arn
  tags        = local.tags
}

module "alb" {
  source            = "../../modules/alb"
  name              = local.name
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  allowed_cidrs     = var.allowed_cidrs
  tags              = local.tags
}

module "monitoring" {
  source          = "../../modules/monitoring"
  name            = local.name
  log_group_names = keys(local.service_images)
  kms_key_arn     = module.secrets.kms_key_arn
  tags            = local.tags
}

module "ecs" {
  source                   = "../../modules/ecs"
  name                     = local.name
  aws_region               = var.aws_region
  vpc_id                   = module.network.vpc_id
  private_subnet_ids       = module.network.private_subnet_ids
  alb_security_group_id    = module.alb.alb_security_group_id
  gateway_target_group_arn = module.alb.blue_target_group_arn
  gateway_blue_target_group_name  = module.alb.blue_target_group_name
  gateway_green_target_group_name = module.alb.green_target_group_name
  alb_listener_arn        = module.alb.listener_arn
  secret_arn               = module.secrets.secret_arn
  kms_key_arn              = module.secrets.kms_key_arn
  s3_bucket_arn            = module.s3.bucket_arn
  common_environment       = local.common_environment
  service_images           = local.service_images
  tags                     = local.tags
}

module "postgres" {
  source                     = "../../modules/postgres"
  name                       = local.name
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = [module.ecs.ecs_security_group_id]
  kms_key_arn                = module.secrets.kms_key_arn
  password                   = var.db_password
  multi_az                   = true
  deletion_protection        = false
  tags                       = local.tags
}

module "redis" {
  source                     = "../../modules/redis"
  name                       = local.name
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = [module.ecs.ecs_security_group_id]
  kms_key_arn                = module.secrets.kms_key_arn
  tags                       = local.tags
}

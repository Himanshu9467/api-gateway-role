variable "name" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "gateway_target_group_arn" {
  type = string
}

variable "gateway_blue_target_group_name" {
  type = string
}

variable "gateway_green_target_group_name" {
  type = string
}

variable "alb_listener_arn" {
  type = string
}

variable "container_port" {
  type    = number
  default = 4000
}

variable "secret_arn" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "s3_bucket_arn" {
  type = string
}

variable "common_environment" {
  type = list(object({
    name  = string
    value = string
  }))
}

variable "service_images" {
  type = map(object({
    repository_name = string
    image_tag       = string
    command         = list(string)
    cpu             = number
    memory          = number
    desired_count   = number
    min_count       = number
    max_count       = number
    environment = list(object({
      name  = string
      value = string
    }))
  }))
}

variable "tags" {
  type = map(string)
}

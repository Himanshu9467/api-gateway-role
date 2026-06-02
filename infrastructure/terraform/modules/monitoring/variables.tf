variable "name" {
  type = string
}

variable "log_group_names" {
  type = list(string)
}

variable "retention_days" {
  type    = number
  default = 30
}

variable "kms_key_arn" {
  type = string
}

variable "alb_metric_dimensions" {
  type    = map(string)
  default = {}
}

variable "tags" {
  type = map(string)
}

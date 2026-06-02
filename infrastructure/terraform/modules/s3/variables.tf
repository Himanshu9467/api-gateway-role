variable "bucket_name" {
  type = string
}

variable "kms_key_arn" {
  type    = string
  default = null
}

variable "replication_role_arn" {
  type    = string
  default = null
}

variable "replication_bucket_arn" {
  type    = string
  default = null
}

variable "tags" {
  type = map(string)
}

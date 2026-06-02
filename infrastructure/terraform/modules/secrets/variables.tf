variable "name" {
  type = string
}

variable "tags" {
  type = map(string)
}

variable "recovery_window_in_days" {
  type    = number
  default = 30
}

variable "create_placeholder_secret" {
  type    = bool
  default = false
}

variable "placeholder_secret" {
  type    = map(string)
  default = {}
}

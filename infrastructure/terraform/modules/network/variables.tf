variable "name" { type = string }
variable "vpc_cidr" { type = string }
variable "enable_nat_gateway" { type = bool }
variable "tags" { type = map(string) }
variable "public_subnets" {
  type = map(object({ cidr = string, az = string }))
}
variable "private_subnets" {
  type = map(object({ cidr = string, az = string }))
}

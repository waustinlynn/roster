variable "env" {
  description = "Environment name (e.g., dev, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs of private subnets for interface endpoint placement"
  type        = list(string)
}

variable "private_route_table_ids" {
  description = "IDs of private route tables for S3 gateway endpoint route associations"
  type        = list(string)
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

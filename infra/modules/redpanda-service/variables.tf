variable "env" {
  description = "Environment name (e.g., dev, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block of the VPC (used for intra-VPC security group rules)"
  type        = string
}

variable "public_subnet_ids" {
  description = "IDs of public subnets for Redpanda task placement (assign_public_ip=true for Docker Hub pull)"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "IDs of private subnets for EFS mount targets"
  type        = list(string)
}

variable "cluster_arn" {
  description = "ARN of the ECS cluster"
  type        = string
}

variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "ecs_task_execution_role_arn" {
  description = "ARN of the shared ECS task execution role"
  type        = string
}

variable "log_group_name" {
  description = "Name of the CloudWatch log group for ECS tasks"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "event_store_bucket_name" {
  description = "Name of the S3 event archive bucket (for Tiered Storage)"
  type        = string
}

variable "event_store_bucket_arn" {
  description = "ARN of the S3 event archive bucket"
  type        = string
}

variable "redpanda_image_tag" {
  description = "Pinned Redpanda Docker Hub image tag (e.g., v23.3.1). No default — must be supplied."
  type        = string
  # Intentionally no default — latest is prohibited (FR-016)
}

variable "cpu" {
  description = "CPU units for the Redpanda Fargate task"
  type        = number
  default     = 1024
}

variable "memory" {
  description = "Memory (MiB) for the Redpanda Fargate task"
  type        = number
  default     = 2048
}

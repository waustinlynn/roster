variable "env" {
  description = "Environment name (e.g., dev, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "public_subnet_ids" {
  description = "IDs of public subnets for ALB placement"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "IDs of private subnets for API task placement"
  type        = list(string)
}

variable "cluster_arn" {
  description = "ARN of the ECS cluster"
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

variable "ecr_api_repo_url" {
  description = "URL of the roster-api ECR repository"
  type        = string
}

variable "image_tag" {
  description = "Pinned API image tag (e.g., 1.0.0). No default — must be supplied."
  type        = string
  # Intentionally no default — latest is prohibited (FR-016)
}

variable "redpanda_endpoint" {
  description = "Redpanda Kafka endpoint (Cloud Map DNS, e.g., redpanda.roster-dev.local:9092)"
  type        = string
}

variable "redpanda_task_sg_id" {
  description = "Security group ID of the Redpanda task (for API → Redpanda egress rule)"
  type        = string
}

variable "vpc_endpoint_sg_id" {
  description = "Security group ID for VPC interface endpoints (ECR, Logs)"
  type        = string
}

variable "cpu" {
  description = "CPU units for the API Fargate task"
  type        = number
  default     = 512
}

variable "memory" {
  description = "Memory (MiB) for the API Fargate task"
  type        = number
  default     = 1024
}

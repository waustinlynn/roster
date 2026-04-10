variable "env" {
  description = "Environment name (e.g., dev, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "api_image_tag" {
  description = "Pinned API Docker image tag. No default — must be supplied on every plan/apply."
  type        = string
}

variable "redpanda_image_tag" {
  description = "Pinned Redpanda Docker Hub image tag. No default — must be supplied on every plan/apply."
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
}

variable "glacier_transition_days" {
  description = "Days before event archive objects transition to Glacier"
  type        = number
}

variable "availability_zones" {
  description = "Availability zones for subnet placement"
  type        = list(string)
}

variable "redpanda_cpu" {
  description = "CPU units for the Redpanda Fargate task"
  type        = number
}

variable "redpanda_memory" {
  description = "Memory (MiB) for the Redpanda Fargate task"
  type        = number
}

variable "container_insights_enabled" {
  description = "Enable ECS Container Insights (incurs CloudWatch cost)"
  type        = bool
}

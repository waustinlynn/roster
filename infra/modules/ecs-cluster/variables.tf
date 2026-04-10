variable "env" {
  description = "Environment name (e.g., dev, prod)"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log group retention in days"
  type        = number
  default     = 14
}

variable "container_insights_enabled" {
  description = "Enable ECS Container Insights (recommended for prod; has cost)"
  type        = bool
  default     = false
}

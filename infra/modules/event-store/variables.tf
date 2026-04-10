variable "env" {
  description = "Environment name (e.g., dev, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "glacier_transition_days" {
  description = "Days before transitioning objects to Glacier storage class"
  type        = number
  default     = 90
}

variable "redpanda_task_role_arn" {
  description = "ARN of the Redpanda ECS task role — granted write access to this bucket"
  type        = string
}

output "redpanda_endpoint" {
  description = "Internal DNS endpoint for Redpanda Kafka (Cloud Map)"
  value       = "redpanda.roster-${var.env}.local:9092"
}

output "redpanda_task_sg_id" {
  description = "Security group ID for the Redpanda Fargate task"
  value       = aws_security_group.redpanda.id
}

output "redpanda_task_role_arn" {
  description = "ARN of the Redpanda ECS task IAM role"
  value       = aws_iam_role.redpanda_task.arn
}

output "efs_file_system_id" {
  description = "ID of the EFS file system used by Redpanda"
  value       = aws_efs_file_system.redpanda.id
}

output "service_discovery_namespace_id" {
  description = "ID of the Cloud Map private DNS namespace"
  value       = aws_service_discovery_private_dns_namespace.roster.id
}

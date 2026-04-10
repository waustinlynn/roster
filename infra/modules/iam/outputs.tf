output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role (used by all ECS tasks)"
  value       = aws_iam_role.ecs_task_execution.arn
}

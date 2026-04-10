output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer (HTTPS endpoint for the API)"
  value       = aws_lb.api.dns_name
}

output "api_task_sg_id" {
  description = "Security group ID for the API Fargate task"
  value       = aws_security_group.api.id
}

output "alb_sg_id" {
  description = "Security group ID for the ALB"
  value       = aws_security_group.alb.id
}

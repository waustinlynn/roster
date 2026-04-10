output "api_url" {
  description = "HTTPS endpoint for the API (ALB DNS name)"
  value       = module.api_service.alb_dns_name
}

output "ui_url" {
  description = "HTTPS endpoint for the UI SPA (CloudFront domain)"
  value       = module.ui_hosting.cloudfront_domain_name
}

output "ecr_api_repo" {
  description = "ECR repository URL for the API image"
  value       = module.ecs_cluster.ecr_api_repo_url
}

output "redpanda_endpoint" {
  description = "Internal Kafka endpoint for the API task"
  value       = module.redpanda_service.redpanda_endpoint
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation"
  value       = module.ui_hosting.cloudfront_distribution_id
}

output "ui_s3_bucket" {
  description = "S3 bucket name for UI asset uploads"
  value       = module.ui_hosting.s3_bucket_name
}

output "efs_file_system_id" {
  description = "EFS file system ID used by Redpanda"
  value       = module.redpanda_service.efs_file_system_id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name (HTTPS endpoint for the SPA)"
  value       = aws_cloudfront_distribution.ui.domain_name
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket hosting the UI assets"
  value       = aws_s3_bucket.ui.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (used for cache invalidation)"
  value       = aws_cloudfront_distribution.ui.id
}

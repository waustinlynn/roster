output "bucket_name" {
  description = "Name of the event archive S3 bucket"
  value       = aws_s3_bucket.events.bucket
}

output "bucket_arn" {
  description = "ARN of the event archive S3 bucket"
  value       = aws_s3_bucket.events.arn
}

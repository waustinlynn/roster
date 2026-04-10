output "endpoint_sg_id" {
  description = "Security group ID for VPC interface endpoints (used by API task egress rule)"
  value       = aws_security_group.endpoints.id
}

output "s3_endpoint_id" {
  description = "ID of the S3 gateway endpoint"
  value       = aws_vpc_endpoint.s3.id
}

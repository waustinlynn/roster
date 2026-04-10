output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of public subnets (ALB + Redpanda task)"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of private subnets (API ECS task)"
  value       = aws_subnet.private[*].id
}

output "private_route_table_ids" {
  description = "IDs of private route tables (for VPC endpoint gateway route associations)"
  value       = [aws_route_table.private.id]
}

# Security group for interface endpoints — allows API task to reach ECR and CloudWatch Logs
resource "aws_security_group" "endpoints" {
  name        = "roster-vpc-endpoints-${var.env}"
  description = "Allow HTTPS inbound to VPC interface endpoints from private subnets"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from private subnets (API task)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.11.0/24", "10.0.12.0/24"] # private subnet CIDRs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "roster-vpc-endpoints-${var.env}"
    env     = var.env
    project = "roster"
  }
}

# S3 Gateway Endpoint — free; enables API task to reach S3 without internet
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = var.private_route_table_ids

  tags = {
    Name    = "roster-s3-endpoint-${var.env}"
    env     = var.env
    project = "roster"
  }
}

# ECR API Interface Endpoint — required for ECR authentication
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true

  tags = {
    Name    = "roster-ecr-api-endpoint-${var.env}"
    env     = var.env
    project = "roster"
  }
}

# ECR DKR Interface Endpoint — required for Docker image layer pulls
resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true

  tags = {
    Name    = "roster-ecr-dkr-endpoint-${var.env}"
    env     = var.env
    project = "roster"
  }
}

# CloudWatch Logs Interface Endpoint — required for ECS log streaming from private subnets
resource "aws_vpc_endpoint" "logs" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true

  tags = {
    Name    = "roster-logs-endpoint-${var.env}"
    env     = var.env
    project = "roster"
  }
}

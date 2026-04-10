resource "aws_ecs_cluster" "main" {
  name = "roster-${var.env}"

  setting {
    name  = "containerInsights"
    value = var.container_insights_enabled ? "enabled" : "disabled"
  }

  tags = {
    Name    = "roster-${var.env}"
    env     = var.env
    project = "roster"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
}

resource "aws_ecr_repository" "api" {
  name                 = "roster-api"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    env     = var.env
    project = "roster"
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/roster-${var.env}"
  retention_in_days = var.log_retention_days

  tags = {
    env     = var.env
    project = "roster"
  }
}

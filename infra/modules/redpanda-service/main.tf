# ─── IAM Task Role ────────────────────────────────────────────────────────────

resource "aws_iam_role" "redpanda_task" {
  name = "roster-redpanda-task-${var.env}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ecs-tasks.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    env     = var.env
    project = "roster"
  }
}

resource "aws_iam_role_policy" "redpanda_s3" {
  name = "redpanda-s3-tiered-storage"
  role = aws_iam_role.redpanda_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${var.event_store_bucket_arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = var.event_store_bucket_arn
      }
    ]
  })
}

# ─── EFS File System ──────────────────────────────────────────────────────────

resource "aws_efs_file_system" "redpanda" {
  lifecycle_policy {
    transition_to_ia = "AFTER_7_DAYS"
  }

  tags = {
    Name    = "roster-redpanda-data-${var.env}"
    env     = var.env
    project = "roster"
  }
}

resource "aws_efs_access_point" "redpanda" {
  file_system_id = aws_efs_file_system.redpanda.id

  root_directory {
    path = "/redpanda/data"
    creation_info {
      owner_uid   = 1000
      owner_gid   = 1000
      permissions = "0755"
    }
  }

  posix_user {
    uid = 1000
    gid = 1000
  }

  tags = {
    env     = var.env
    project = "roster"
  }
}

resource "aws_security_group" "efs" {
  name        = "roster-redpanda-efs-${var.env}"
  description = "Allow NFS from Redpanda task only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "NFS from Redpanda task"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.redpanda.id]
  }

  tags = {
    Name    = "roster-redpanda-efs-${var.env}"
    env     = var.env
    project = "roster"
  }
}

resource "aws_efs_mount_target" "redpanda" {
  count = length(var.private_subnet_ids)

  file_system_id  = aws_efs_file_system.redpanda.id
  subnet_id       = var.private_subnet_ids[count.index]
  security_groups = [aws_security_group.efs.id]
}

# ─── Security Group ───────────────────────────────────────────────────────────

resource "aws_security_group" "redpanda" {
  name        = "roster-redpanda-${var.env}"
  description = "Redpanda Fargate task - Kafka accessible from API task only"
  vpc_id      = var.vpc_id

  # Kafka - inbound from within VPC only (API task SG rule added in api-service module)
  # Using VPC CIDR here; api-service module adds a more targeted SG rule
  ingress {
    description = "Kafka from within VPC"
    from_port   = 9092
    to_port     = 9092
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # Admin API - VPC only
  ingress {
    description = "Redpanda admin API from within VPC"
    from_port   = 9644
    to_port     = 9644
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # All outbound (Docker Hub pull via IGW, S3 Tiered Storage uploads)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "roster-redpanda-${var.env}"
    env     = var.env
    project = "roster"
  }
}

# ─── Cloud Map Service Discovery ──────────────────────────────────────────────

resource "aws_service_discovery_private_dns_namespace" "roster" {
  name        = "roster-${var.env}.local"
  description = "Private DNS namespace for Roster services"
  vpc         = var.vpc_id

  tags = {
    env     = var.env
    project = "roster"
  }
}

resource "aws_service_discovery_service" "redpanda" {
  name = "redpanda"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.roster.id
    routing_policy = "MULTIVALUE"

    dns_records {
      ttl  = 10
      type = "A"
    }
  }


  tags = {
    env     = var.env
    project = "roster"
  }
}

# ─── ECS Task Definition & Service ───────────────────────────────────────────

resource "aws_ecs_task_definition" "redpanda" {
  family                   = "roster-redpanda-${var.env}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = aws_iam_role.redpanda_task.arn

  volume {
    name = "redpanda-data"

    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.redpanda.id
      transit_encryption = "ENABLED"

      authorization_config {
        access_point_id = aws_efs_access_point.redpanda.id
        iam             = "ENABLED"
      }
    }
  }

  container_definitions = jsonencode([
    {
      name  = "redpanda"
      image = "vectorized/redpanda:${var.redpanda_image_tag}"

      command = [
        "redpanda",
        "start",
        "--overprovisioned",
        "--smp", "1",
        "--memory", "512M",
        "--reserve-memory", "0M",
        "--default-log-level=warn",
        "--kafka-addr", "0.0.0.0:9092",
        "--advertise-kafka-addr", "redpanda.roster-${var.env}.local:9092",
        "--pandaproxy-addr", "0.0.0.0:8082",
        "--schema-registry-addr", "0.0.0.0:8081",
        "--rpc-addr", "0.0.0.0:33145"
      ]

      environment = [
        { name = "REDPANDA_ADVERTISE_KAFKA_ADDR", value = "redpanda.roster-${var.env}.local:9092" },
        { name = "CLOUD_STORAGE_ENABLED", value = "true" },
        { name = "CLOUD_STORAGE_REGION", value = var.aws_region },
        { name = "CLOUD_STORAGE_BUCKET", value = var.event_store_bucket_name },
        { name = "CLOUD_STORAGE_CREDENTIALS_SOURCE", value = "aws_instance_metadata" }
      ]

      mountPoints = [
        {
          sourceVolume  = "redpanda-data"
          containerPath = "/var/lib/redpanda/data"
          readOnly      = false
        }
      ]

      portMappings = [
        { containerPort = 9092, protocol = "tcp" },
        { containerPort = 9644, protocol = "tcp" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.log_group_name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "redpanda"
        }
      }

      essential = true
    }
  ])

  tags = {
    env     = var.env
    project = "roster"
  }
}

resource "aws_ecs_service" "redpanda" {
  name            = "roster-redpanda-${var.env}"
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.redpanda.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  # EFS mount targets can take 60–90s to become available
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [aws_security_group.redpanda.id]
    assign_public_ip = true # Required for Docker Hub image pull via IGW
  }

  service_registries {
    registry_arn = aws_service_discovery_service.redpanda.arn
  }

  # Ignore task definition changes (image tag updates trigger new deployments separately)
  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = {
    env     = var.env
    project = "roster"
  }
}

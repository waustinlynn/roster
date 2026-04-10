# ─── IAM Task Role ────────────────────────────────────────────────────────────

resource "aws_iam_role" "api_task" {
  name = "roster-api-task-${var.env}"

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

resource "aws_iam_role_policy" "api_logs" {
  name = "api-cloudwatch-logs"
  role = aws_iam_role.api_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/ecs/roster-${var.env}:*"
      }
    ]
  })
}

# ─── Self-Signed TLS Certificate ──────────────────────────────────────────────

resource "tls_private_key" "alb_self_signed" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "alb" {
  private_key_pem = tls_private_key.alb_self_signed.private_key_pem

  subject {
    common_name  = "roster-api-${var.env}.internal"
    organization = "Roster"
  }

  # SAN required by AWS ALB — must be a valid FQDN (at least one dot)
  dns_names = ["roster-api-${var.env}.internal"]

  validity_period_hours = 8760 # 1 year

  allowed_uses = [
    "key_encipherment",
    "digital_signature",
    "server_auth",
  ]
}

resource "aws_acm_certificate" "alb_self_signed" {
  private_key      = tls_private_key.alb_self_signed.private_key_pem
  certificate_body = tls_self_signed_cert.alb.cert_pem

  tags = {
    Name    = "roster-api-self-signed-${var.env}"
    env     = var.env
    project = "roster"
  }
}

# ─── ALB Security Group ───────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "roster-alb-${var.env}"
  description = "ALB - HTTPS and HTTP redirect from internet"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from internet (redirect to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "roster-alb-${var.env}"
    env     = var.env
    project = "roster"
  }
}

# ─── API Task Security Group ──────────────────────────────────────────────────

resource "aws_security_group" "api" {
  name        = "roster-api-${var.env}"
  description = "API Fargate task - inbound from ALB, outbound to Redpanda and VPC endpoints"
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTP from ALB"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description     = "Kafka to Redpanda"
    from_port       = 9092
    to_port         = 9092
    protocol        = "tcp"
    security_groups = [var.redpanda_task_sg_id]
  }

  egress {
    description     = "HTTPS to VPC endpoints (ECR, CloudWatch Logs)"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [var.vpc_endpoint_sg_id]
  }

  tags = {
    Name    = "roster-api-${var.env}"
    env     = var.env
    project = "roster"
  }
}

# ─── ALB & Listeners ──────────────────────────────────────────────────────────

resource "aws_lb" "api" {
  name               = "roster-api-${var.env}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  tags = {
    env     = var.env
    project = "roster"
  }
}

resource "aws_lb_target_group" "api" {
  name        = "roster-api-${var.env}"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    port                = "8080"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
    matcher             = "200"
  }

  tags = {
    env     = var.env
    project = "roster"
  }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.alb_self_signed.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ─── ECS Task Definition & Service ───────────────────────────────────────────

resource "aws_ecs_task_definition" "api" {
  family                   = "roster-api-${var.env}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = aws_iam_role.api_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${var.ecr_api_repo_url}:${var.image_tag}"

      portMappings = [
        { containerPort = 8080, protocol = "tcp" }
      ]

      environment = [
        { name = "ASPNETCORE_URLS", value = "http://+:8080" },
        { name = "Redpanda__BootstrapServers", value = var.redpanda_endpoint },
        { name = "Redpanda__Topic", value = "roster-events" }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
        interval    = 10
        timeout     = 5
        retries     = 6
        startPeriod = 30
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.log_group_name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
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

resource "aws_ecs_service" "api" {
  name            = "roster-api-${var.env}"
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8080
  }

  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = {
    env     = var.env
    project = "roster"
  }
}

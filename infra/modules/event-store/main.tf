resource "aws_s3_bucket" "events" {
  bucket        = "roster-events-archive-${var.env}"
  force_destroy = false

  tags = {
    Name    = "roster-events-archive-${var.env}"
    env     = var.env
    project = "roster"
  }
}

resource "aws_s3_bucket_versioning" "events" {
  bucket = aws_s3_bucket.events.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "events" {
  bucket = aws_s3_bucket.events.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "events" {
  bucket = aws_s3_bucket.events.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "events" {
  bucket = aws_s3_bucket.events.id

  rule {
    id     = "glacier-transition"
    status = "Enabled"

    transition {
      days          = var.glacier_transition_days
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_policy" "events" {
  bucket = aws_s3_bucket.events.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowRedpandaTaskAccess"
        Effect = "Allow"
        Principal = {
          AWS = var.redpanda_task_role_arn
        }
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.events.arn}/*"
      },
      {
        Sid    = "AllowRedpandaTaskList"
        Effect = "Allow"
        Principal = {
          AWS = var.redpanda_task_role_arn
        }
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.events.arn
      }
    ]
  })
}

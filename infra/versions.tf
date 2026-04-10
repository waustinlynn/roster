terraform {
  required_version = ">= 1.6"

  # Partial backend config — supply env-specific values at init:
  #   terraform init -backend-config=envs/dev.backend.hcl
  #   terraform init -backend-config=envs/prod.backend.hcl
  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = ">= 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      env     = var.env
      project = "roster"
    }
  }
}

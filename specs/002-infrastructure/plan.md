# Implementation Plan: Infrastructure Provisioning

**Branch**: `002-infrastructure` | **Date**: 2026-03-17 | **Spec**: [spec.md](spec.md)

## Summary

All AWS infrastructure for the roster management application provisioned via Terraform.
The architecture is composed of reusable child modules consumed by per-environment root
modules (`dev`, `prod`). Key considerations: EFS persistence for Redpanda hot log segments,
ALB health-check gating for the API's aggregate replay pattern, and S3+CloudFront for
static UI hosting. Terraform remote state in S3 + DynamoDB locking.

## Technical Context

**Language/Version**: Terraform ≥ 1.6, AWS Provider ≥ 5.0, Terraform `tls` provider ≥ 4.0
**Primary Dependencies**:
- AWS: ECS Fargate, ECR (roster-api only), ALB (HTTPS), EFS, S3, CloudFront, VPC, VPC Endpoints, IAM, CloudWatch Logs, ACM (self-signed import), Cloud Map (Service Discovery)
- Terraform modules: `hashicorp/aws` + `hashicorp/tls` providers; all local modules (no registry)
**Storage**: S3 remote state backend; DynamoDB lock table (manually bootstrapped)
**Testing**: `terraform validate`, `terraform plan` with no diff on re-apply (idempotency);
  manual smoke tests per acceptance scenario in spec.md
**Target Platform**: AWS `us-east-1`; all ECS tasks on Fargate; API task in private subnets, Redpanda task in public subnets
**Performance Goals**: `terraform apply` completes in < 5 minutes for a fresh dev environment
**Constraints**: No Route 53 / custom domain in v1; self-signed ACM cert for ALB HTTPS; no NAT gateway; no WAF; single-node Redpanda only; no CI/CD pipeline infrastructure in this spec; all image tags must be explicitly pinned (no `latest`)

## Constitution Check

- [x] **I. Monorepo Structure** — All Terraform code lives under `infra/`; no cross-concern
  changes to `api/` or `ui/`.
- [x] **II. DDD Layering** — Not applicable to Terraform; module boundaries follow service
  ownership (networking, ecs-cluster, api-service, redpanda-service, ui-hosting,
  event-store, iam).
- [x] **III. SOLID** — Each Terraform module has a single responsibility and exposes
  clean input/output contracts; no hardcoded values in modules (all parameterised).
- [x] **IV. TDD** — Terraform has no unit test framework in scope for v1; acceptance is
  validated by `terraform plan` + manual smoke tests against deployed environment.
- [x] **V. OpenAPI-First** — Not applicable to infrastructure.
- [x] **VI. Infrastructure as Code** — 100% of AWS resources defined in Terraform;
  zero manual console resources after bootstrap. All modules include `versions.tf` with
  explicit `required_providers` + `required_version` constraints (AWS ≥ 5.0, tls ≥ 4.0,
  Terraform ≥ 1.6).
- [x] **VII. Frontend Data Layer** — Not applicable to infrastructure.

## Source Code Structure

```
infra/
├── modules/
│   ├── networking/           # VPC, subnets (2 public + 2 private), IGW, route tables
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── versions.tf       # required_providers + required_version
│   ├── vpc-endpoints/        # S3 gateway endpoint, ECR API/DKR + Logs interface endpoints
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── versions.tf
│   ├── ecs-cluster/          # ECS Fargate cluster, ECR repo (roster-api), CloudWatch log group
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── versions.tf
│   ├── api-service/          # ECS task def + service, ALB (HTTPS), target group, SGs, IAM
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── versions.tf
│   ├── redpanda-service/     # ECS task def + service (public subnet), EFS, SGs, IAM
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── versions.tf
│   ├── ui-hosting/           # S3 bucket (private), CloudFront, OAC
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── versions.tf
│   ├── event-store/          # S3 archive bucket, lifecycle policy, bucket policy
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── versions.tf
│   └── iam/                  # Shared policies (ECS task execution role)
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── versions.tf
├── environments/
│   ├── dev/
│   │   ├── main.tf           # Root module: compose all child modules
│   │   ├── variables.tf
│   │   ├── versions.tf       # Backend block + provider version constraints
│   │   ├── terraform.tfvars  # Dev-specific overrides
│   │   └── outputs.tf
│   └── prod/
│       ├── main.tf
│       ├── variables.tf
│       ├── versions.tf
│       ├── terraform.tfvars
│       └── outputs.tf
└── bootstrap/
    └── README.md             # Instructions for manual S3 state bucket + DDB table
```

## Key Design Decisions

### Networking
- VPC CIDR: `10.0.0.0/16`
- 2 public subnets (ALB + Redpanda task): `10.0.1.0/24`, `10.0.2.0/24` in `us-east-1a`, `us-east-1b`
- 2 private subnets (API ECS task): `10.0.11.0/24`, `10.0.12.0/24`
- **No NAT gateway** — the Redpanda task runs in a public subnet (assign_public_ip = true) so it can reach Docker Hub via the IGW at zero extra cost. The API task is in a private subnet and reaches ECR/S3/Logs via VPC endpoints.

### VPC Endpoints (replaces NAT gateway)
| Endpoint | Type | Cost | Purpose |
|----------|------|------|---------|
| `com.amazonaws.us-east-1.s3` | Gateway | Free | Redpanda Tiered Storage uploads; Terraform state |
| `com.amazonaws.us-east-1.ecr.api` | Interface | ~$7/mo | API task ECR authentication |
| `com.amazonaws.us-east-1.ecr.dkr` | Interface | ~$7/mo | API task image pull |
| `com.amazonaws.us-east-1.logs` | Interface | ~$7/mo | API task CloudWatch Logs |

Gateway endpoint routes are attached to the private route table. Interface endpoints are placed in private subnets with a dedicated security group allowing HTTPS (443) inbound from the API task security group only.

### Redpanda Task Placement
- Runs in a **public subnet** with `assign_public_ip = true`
- Pulls `vectorized/redpanda:{version}` directly from Docker Hub via the internet gateway
- Version tag pinned via explicit Terraform variable (no default — caller must supply)
- Security group blocks all inbound from `0.0.0.0/0`; Kafka (9092) is only reachable from the API task SG within the VPC
- EFS mount targets are in private subnets; Redpanda accesses them via intra-VPC routing

### Redpanda EFS Configuration
- EFS file system with `AFTER_7_DAYS` lifecycle policy (infrequent access tier)
- One access point at `/redpanda/data` (uid/gid 1000 — matches Redpanda container user)
- Mount target in each private subnet
- Security group: allow NFS (2049) from Redpanda task SG only

### API ALB — HTTPS & Health Check
No custom domain in v1. A self-signed TLS certificate is generated by Terraform and imported
into ACM to satisfy the HTTPS listener requirement. Clients must use `-k` / `--insecure` until
a real cert is attached.

```hcl
# Self-signed cert (generated by Terraform tls provider)
resource "tls_private_key" "alb_self_signed" { algorithm = "RSA"; rsa_bits = 2048 }
resource "tls_self_signed_cert" "alb" {
  private_key_pem       = tls_private_key.alb_self_signed.private_key_pem
  validity_period_hours = 8760  # 1 year
  subject { common_name = "roster-api-dev" }
  allowed_uses          = ["key_encipherment", "digital_signature", "server_auth"]
}
resource "aws_acm_certificate" "alb_self_signed" {
  private_key      = tls_private_key.alb_self_signed.private_key_pem
  certificate_body = tls_self_signed_cert.alb.cert_pem
}

# Listeners
resource "aws_lb_listener" "http_redirect" {
  port     = 80; protocol = "HTTP"
  default_action { type = "redirect"
    redirect { port = "443"; protocol = "HTTPS"; status_code = "HTTP_301" } }
}
resource "aws_lb_listener" "https" {
  port            = 443; protocol = "HTTPS"
  ssl_policy      = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn = aws_acm_certificate.alb_self_signed.arn
  default_action  { type = "forward"; target_group_arn = aws_lb_target_group.api.arn }
}

# Target group health check
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
```

### ECS Task Health Check (API)
```hcl
healthCheck = {
  command     = ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
  interval    = 10
  timeout     = 5
  retries     = 6
  startPeriod = 30
}
```

### Redpanda Task Environment Variables
Passed via ECS task definition `environment` block (not SSM/Secrets Manager for v1).
The Redpanda image is `vectorized/redpanda:{var.redpanda_image_tag}` pulled from Docker Hub
(no ECR repo — task runs in public subnet with internet access via IGW).

Required env vars for single-node + Tiered Storage:
```
REDPANDA_ADVERTISE_KAFKA_ADDR   = redpanda.{namespace}.local:9092  (Cloud Map DNS)
CLOUD_STORAGE_ENABLED           = true
CLOUD_STORAGE_REGION            = us-east-1
CLOUD_STORAGE_BUCKET            = {event_store_bucket_name}
CLOUD_STORAGE_CREDENTIALS_SOURCE= aws_instance_metadata  # ECS task role via container metadata endpoint
```
Redpanda node flags (ECS command override):
`--overprovisioned --smp 1 --memory 512M --reserve-memory 0M --default-log-level=warn`

### CloudFront / S3 UI Hosting
- S3 bucket: `roster-ui-{env}` — private, versioning enabled
- OAC (Origin Access Control, not legacy OAI) for CloudFront → S3
- Default root object: `index.html`; custom error response: `404 → /index.html, 200` (SPA routing)

### Remote State
- S3 bucket: `roster-terraform-state-{suffix}` (manually created, versioning enabled)
- DynamoDB table: `roster-terraform-locks` (manually created, PAY_PER_REQUEST)
- Backend key per environment: `{env}/terraform.tfstate`

## Module Dependency Order

```
iam → networking → ecs-cluster  ──────────────────────────────────────────────────┐
               └→ vpc-endpoints (private subnets + route tables from networking)   │
                              → event-store                                         │
                              → redpanda-service (networking, ecs-cluster,          │
                                                  event-store, iam)                 │
                              → api-service (networking, ecs-cluster,               │
                                             vpc-endpoints, redpanda-service, iam)  │
               └→ ui-hosting (largely independent; needs aws account context only) ─┘
                                                                                    │
   All modules complete → environments/dev + environments/prod ─────────────────────┘
```

Key wiring notes:
- `vpc-endpoints` receives `vpc_id`, `private_subnet_ids`, `private_route_table_ids`, `api_task_sg_id` from networking/api-service
- `api-service` receives `vpc_endpoint_sg_id` from `vpc-endpoints` (to allow HTTPS 443 inbound on interface endpoints)
- `redpanda-service` places tasks in `public_subnet_ids` (from networking); EFS mount targets in `private_subnet_ids`
- Terraform handles ordering automatically via output references in the environment root module

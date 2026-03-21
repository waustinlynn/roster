# Implementation Plan: Infrastructure Provisioning

**Branch**: `002-infrastructure` | **Date**: 2026-03-17 | **Spec**: [spec.md](spec.md)

## Summary

All AWS infrastructure for the roster management application provisioned via Terraform.
The architecture is composed of reusable child modules consumed by per-environment root
modules (`dev`, `prod`). Key considerations: EFS persistence for Redpanda hot log segments,
ALB health-check gating for the API's aggregate replay pattern, and S3+CloudFront for
static UI hosting. Terraform remote state in S3 + DynamoDB locking.

## Technical Context

**Language/Version**: Terraform ≥ 1.6, AWS Provider ≥ 5.0
**Primary Dependencies**:
- AWS: ECS Fargate, ECR, ALB, EFS, S3, CloudFront, VPC, IAM, CloudWatch Logs
- Terraform modules: `hashicorp/aws` provider; no external module registry (all local modules)
**Storage**: S3 remote state backend; DynamoDB lock table (manually bootstrapped)
**Testing**: `terraform validate`, `terraform plan` with no diff on re-apply (idempotency);
  manual smoke tests per acceptance scenario in spec.md
**Target Platform**: AWS `us-east-1`; all ECS tasks on Fargate launch type
**Performance Goals**: `terraform apply` completes in < 5 minutes for a fresh dev environment
**Constraints**: No Route 53 / custom domain in v1; no ACM certs; no WAF; single-node
  Redpanda only; no CI/CD pipeline infrastructure in this spec

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
  zero manual console resources after bootstrap.
- [x] **VII. Frontend Data Layer** — Not applicable to infrastructure.

## Source Code Structure

```
infra/
├── modules/
│   ├── networking/           # VPC, subnets, IGW, NAT, route tables
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── ecs-cluster/          # ECS Fargate cluster, ECR repo, CloudWatch log group
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── api-service/          # ECS task def + service, ALB, target group, SGs, IAM
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── redpanda-service/     # ECS task def + service, EFS FS + AP + mount, SGs, IAM
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── ui-hosting/           # S3 bucket (private), CloudFront, OAC
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── event-store/          # S3 archive bucket, lifecycle policy, bucket policy
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── iam/                  # Shared policies (ECS task execution role)
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── environments/
│   ├── dev/
│   │   ├── main.tf           # Root module: compose all child modules
│   │   ├── variables.tf
│   │   ├── terraform.tfvars  # Dev-specific overrides
│   │   └── outputs.tf
│   └── prod/
│       ├── main.tf
│       ├── variables.tf
│       ├── terraform.tfvars
│       └── outputs.tf
└── bootstrap/
    └── README.md             # Instructions for manual S3 state bucket + DDB table
```

## Key Design Decisions

### Networking
- VPC CIDR: `10.0.0.0/16`
- 2 public subnets (ALB): `10.0.1.0/24`, `10.0.2.0/24` in `us-east-1a`, `us-east-1b`
- 2 private subnets (ECS tasks): `10.0.11.0/24`, `10.0.12.0/24`
- Single NAT gateway in `us-east-1a` (cost trade-off for v1; multi-AZ NAT for prod)

### Redpanda EFS Configuration
- EFS file system with `AFTER_7_DAYS` lifecycle policy (infrequent access tier)
- One access point at `/redpanda/data` (uid/gid 1000 — matches Redpanda container user)
- Mount target in each private subnet
- Security group: allow NFS (2049) from Redpanda task SG only

### API ALB Health Check
```hcl
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
Passed via ECS task definition `environment` block (not SSM/Secrets Manager for v1):
- `REDPANDA_BOOTSTRAP_SERVERS`: internal DNS of Redpanda service (`redpanda.roster.local:9092`)
- Redpanda tiered storage config via `rpk` bootstrap or `pandaproxy_client.yaml`

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
iam → networking → ecs-cluster
                              → event-store
                              → redpanda-service (needs networking, ecs-cluster, event-store)
                              → api-service (needs networking, ecs-cluster, redpanda-service)
                 → ui-hosting (needs networking for context only; largely independent)
```

Terraform handles this via `depends_on` and output references automatically when composed
in the environment root module.

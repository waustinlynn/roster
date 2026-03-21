# Feature Specification: Infrastructure Provisioning

**Feature Branch**: `002-infrastructure`
**Created**: 2026-03-17
**Status**: Draft

## Overview

Provision all AWS infrastructure required to run the youth sports roster management application using Terraform. Infrastructure must support the event-sourced architecture: a stateful Redpanda Fargate task persisting to EFS (hot segments) with async archival to S3 (Tiered Storage), an ASP.NET Core API Fargate task with ALB health-check gating, and a React SPA hosted on S3+CloudFront.

---

## User Scenarios & Testing

### User Story 1 — Networking & Core Cluster (Priority: P1)

A developer runs `terraform apply` in the dev environment and gets a working VPC with public/private subnets, an ECS Fargate cluster, and the ECR repository for the API image.

**Why this priority**: Everything else depends on VPC, subnets, security groups, and the ECS cluster.

**Independent Test**: `terraform plan` produces zero errors; the ECS cluster appears in the AWS console; `aws ecr describe-repositories` returns the API repo.

**Acceptance Scenarios**:

1. **Given** an AWS account with valid credentials, **When** `terraform apply` is run in `infra/environments/dev`, **Then** a VPC, two public subnets, two private subnets, an internet gateway, and a NAT gateway are created.
2. **Given** the VPC is created, **When** the cluster module is applied, **Then** an ECS Fargate cluster named `roster-dev` exists and the ECR repo `roster-api` is accessible.

---

### User Story 2 — Redpanda Service (Priority: P2)

The Redpanda Fargate task starts, mounts an EFS volume for log persistence, and can be reached by the API task on port 9092.

**Why this priority**: Redpanda is the event store — the API cannot function without it. Depends on US1.

**Independent Test**: After `terraform apply`, SSH/exec into the API task and confirm `telnet redpanda-service 9092` connects; EFS mount is visible inside the Redpanda container.

**Acceptance Scenarios**:

1. **Given** the cluster and networking are ready, **When** the redpanda-service module is applied, **Then** a Fargate task running `vectorized/redpanda` starts, mounts the EFS access point, and the `roster-events` topic can be created via `rpk`.
2. **Given** Redpanda is running, **When** the ECS task is stopped and restarted, **Then** previously written log segments survive on EFS (data durability verified by topic offset continuity).
3. **Given** Redpanda is running, **When** a log segment ages past the tiering threshold, **Then** Redpanda uploads it to the S3 archive bucket automatically.

---

### User Story 3 — API Service (Priority: P3)

The API Fargate task starts, passes the ALB health check (`GET /health`), and begins receiving traffic only after aggregate replay completes.

**Why this priority**: Depends on US2 (Redpanda must be up before the API can replay events). The ALB and health check gating are safety-critical.

**Independent Test**: After deployment, `curl https://{alb-dns}/health` returns `200 {"status":"Healthy"}`. Before replay completes, the target is `503`.

**Acceptance Scenarios**:

1. **Given** the API image is pushed to ECR, **When** ECS deploys the task, **Then** the ALB health check polls `GET /health` at 10s intervals and the task only enters `HEALTHY` after the in-memory replay completes.
2. **Given** the ALB target is healthy, **When** a request hits the ALB, **Then** it is routed to the API task and returns a valid response.
3. **Given** the API task restarts, **When** replay is in progress, **Then** the ALB keeps the old task healthy until the new task passes health checks (blue/green via ECS rolling deploy).

---

### User Story 4 — UI Hosting (Priority: P4)

Static React SPA build artifacts are served from S3 via CloudFront with HTTPS and cache invalidation on deploy.

**Why this priority**: Can be provisioned independently of Redpanda/API (decoupled static hosting), but depends on US1 (IAM/account context).

**Independent Test**: After `aws s3 sync dist/ s3://roster-ui-dev/`, `curl https://{cloudfront-url}/index.html` returns `200`.

**Acceptance Scenarios**:

1. **Given** the CloudFront distribution and S3 bucket are created, **When** build artifacts are synced to S3, **Then** the SPA is accessible at the CloudFront URL over HTTPS.
2. **Given** a new build is deployed, **When** `aws cloudfront create-invalidation --paths "/*"` runs, **Then** stale assets are purged within 60 seconds.

---

### Edge Cases

- What happens if the EFS access point is unavailable when Redpanda starts? The Fargate task should fail fast and ECS should retry.
- What happens if the ECR image does not exist when the API task starts? The ECS service should stay in a `PENDING` state and not mark itself healthy.
- What happens if the S3 archive bucket is unreachable? Redpanda continues writing to EFS; Tiered Storage retries silently — no data loss for hot segments.
- What happens if the NAT gateway is removed? Private subnet tasks lose outbound internet access (ECR image pull fails, Tiered Storage upload fails).
- How are secrets (Redpanda bootstrap address) passed to the API task? Via ECS task environment variables; no plaintext in Terraform state for sensitive values.

---

## Requirements

### Functional Requirements

- **FR-001**: Infrastructure MUST be defined entirely in Terraform (no manual AWS console resources).
- **FR-002**: Infrastructure MUST support at least two environments: `dev` and `prod`, with per-environment variable overrides.
- **FR-003**: Terraform state MUST be stored remotely in S3 with DynamoDB locking (state bucket and table created manually as a bootstrap step).
- **FR-004**: Networking MUST include a VPC with public subnets (ALB) and private subnets (ECS tasks), plus an internet gateway and NAT gateway.
- **FR-005**: The ECS cluster MUST use Fargate launch type for all tasks (no EC2 instances to manage).
- **FR-006**: The Redpanda Fargate task MUST mount an EFS volume at the Redpanda data directory so log segments survive container restarts.
- **FR-007**: The Redpanda Fargate task MUST have IAM permissions to write to the S3 Tiered Storage archive bucket.
- **FR-008**: The API Fargate task MUST have an ALB target group with a health check on `GET /health`, `interval=10`, `timeout=5`, `unhealthy_threshold=2`, `healthy_threshold=2`.
- **FR-009**: The ECS task definition for the API MUST include an ECS-level health check: `["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]` with `startPeriod=30`, `interval=10`, `retries=6`, `timeout=5`.
- **FR-010**: An ECR repository MUST be provisioned for the API Docker image with image tag immutability enabled.
- **FR-011**: The UI S3 bucket MUST be private; CloudFront MUST be the only origin accessor (Origin Access Control).
- **FR-012**: CloudFront MUST enforce HTTPS; HTTP requests MUST be redirected to HTTPS.
- **FR-013**: IAM roles MUST follow least-privilege: the API task role MUST NOT have write access to the S3 archive bucket; only the Redpanda task role has that permission.
- **FR-014**: Security groups MUST only allow necessary port access: ALB → API (8080), API → Redpanda (9092), Redpanda → S3 (HTTPS outbound), CloudFront → S3 (via OAC).
- **FR-015**: Terraform outputs MUST include: `api_url` (ALB DNS), `ui_url` (CloudFront URL), `ecr_api_repo` (ECR URI), `redpanda_endpoint` (internal DNS).

### Key Entities

- **VPC Module** (`infra/modules/networking`): VPC, subnets (2 public + 2 private), IGW, NAT gateway, route tables.
- **ECS Cluster Module** (`infra/modules/ecs-cluster`): Fargate cluster, ECR repository, CloudWatch log group.
- **API Service Module** (`infra/modules/api-service`): ECS task definition, ECS service, ALB, target group, listener, security groups, IAM task execution role + task role.
- **Redpanda Service Module** (`infra/modules/redpanda-service`): ECS task definition, ECS service, EFS file system + access point + mount target, security groups, IAM task role (S3 write for Tiered Storage).
- **UI Hosting Module** (`infra/modules/ui-hosting`): S3 bucket (private), CloudFront distribution, Origin Access Control, ACM certificate (optional for custom domain).
- **Event Store Module** (`infra/modules/event-store`): S3 bucket for Redpanda Tiered Storage archive, lifecycle policy (transition to Glacier after 90 days), bucket policy.
- **IAM Module** (`infra/modules/iam`): Shared IAM policies and roles reused across service modules.
- **Environment Root** (`infra/environments/dev`, `infra/environments/prod`): Root module composing all child modules with environment-specific variable values.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: `terraform apply` completes with zero errors in a clean AWS account for the dev environment.
- **SC-002**: The API is reachable at the ALB DNS within 5 minutes of `terraform apply` completing (assuming the API image is already in ECR).
- **SC-003**: Redpanda data survives a Fargate task stop-and-restart (EFS persistence verified by reading committed offsets after restart).
- **SC-004**: The UI SPA loads over HTTPS at the CloudFront URL with no direct S3 URL exposure.
- **SC-005**: `terraform plan` on an already-applied environment shows zero changes (idempotency).
- **SC-006**: All infrastructure changes between environments are driven by Terraform variable overrides only; no module code duplication between dev and prod.

---

## Assumptions

- Terraform remote state S3 bucket and DynamoDB lock table are created manually as a one-time bootstrap step before `terraform init` is run.
- A Route 53 hosted zone and custom domain are out of scope for v1; ALB DNS and CloudFront domain names are used directly.
- ACM certificate provisioning (HTTPS custom domain) is deferred to a future iteration; CloudFront default `*.cloudfront.net` HTTPS is used in v1.
- Single Redpanda node (no cluster) is sufficient for v1 scale.
- ECS tasks run in private subnets with NAT gateway for outbound internet access (ECR pulls, S3 uploads).
- The Redpanda image is pulled directly from Docker Hub (`vectorized/redpanda`) — no ECR repo needed for it.
- AWS region: `us-east-1` for all resources.
- Terraform version ≥ 1.6; AWS provider ≥ 5.0.

---

## Out of Scope

- Route 53 DNS and custom domain configuration.
- ACM certificate management.
- Multi-region deployment.
- Redpanda cluster (multi-node) configuration.
- CI/CD pipeline infrastructure (GitHub Actions workflows are in the application repo).
- Monitoring/alerting infrastructure (CloudWatch alarms, dashboards) — deferred to a future iteration.
- WAF or Shield configuration.

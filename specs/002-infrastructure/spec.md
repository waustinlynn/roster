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

1. **Given** an AWS account with valid credentials, **When** `terraform apply` is run in `infra/environments/dev`, **Then** a VPC, two public subnets, two private subnets, an internet gateway, and VPC endpoints (S3 gateway + ECR API/DKR/Logs interface) are created. No NAT gateway is created.
2. **Given** the VPC is created, **When** the cluster module is applied, **Then** an ECS Fargate cluster named `roster-dev` exists and the ECR repo `roster-api` is accessible.
3. **Given** the API task is running in a private subnet, **When** it pulls an image or writes logs, **Then** traffic routes via VPC endpoints and does not traverse the internet gateway.

---

### User Story 2 — Redpanda Service (Priority: P2)

The Redpanda Fargate task starts, mounts an EFS volume for log persistence, and can be reached by the API task on port 9092.

**Why this priority**: Redpanda is the event store — the API cannot function without it. Depends on US1.

**Independent Test**: After `terraform apply`, exec into the API task and confirm `telnet redpanda-service 9092` connects; exec into the Redpanda task and confirm the EFS mount is visible. Confirm the Redpanda task has a public IP (visible in ECS task details) but port 9092 is not reachable from the public internet (security group blocks it).

**Acceptance Scenarios**:

1. **Given** the cluster and networking are ready, **When** the redpanda-service module is applied, **Then** a Fargate task running `vectorized/redpanda` starts, mounts the EFS access point, and the `roster-events` topic can be created via `rpk`.
2. **Given** Redpanda is running, **When** the ECS task is stopped and restarted, **Then** previously written log segments survive on EFS (data durability verified by topic offset continuity).
3. **Given** Redpanda is running, **When** a log segment ages past the tiering threshold, **Then** Redpanda uploads it to the S3 archive bucket automatically.

---

### User Story 3 — API Service (Priority: P3)

The API Fargate task starts, passes the ALB health check (`GET /health`), and begins receiving traffic only after aggregate replay completes.

**Why this priority**: Depends on US2 (Redpanda must be up before the API can replay events). The ALB and health check gating are safety-critical.

**Independent Test**: After deployment, `curl -k https://{alb-dns}/health` returns `200 {"status":"Healthy"}` (the `-k` flag accepts the self-signed certificate used in dev). Before replay completes, the target is `503`.

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
- What happens if a VPC endpoint is unavailable or misconfigured? ECS tasks in private subnets will fail to pull images or write logs. Endpoint health should be verified after `terraform apply` before deploying tasks.
- What happens if a new outbound destination is needed that has no VPC endpoint? A NAT gateway must be added. The spec must be updated to document the justification.
- How are secrets (Redpanda bootstrap address) passed to the API task? Via ECS task environment variables; no plaintext in Terraform state for sensitive values.

---

## Requirements

### Functional Requirements

- **FR-001**: Infrastructure MUST be defined entirely in Terraform (no manual AWS console resources).
- **FR-002**: Infrastructure MUST support at least two environments: `dev` and `prod`, with per-environment variable overrides.
- **FR-003**: Terraform state MUST be stored remotely in S3 with DynamoDB locking (state bucket and table created manually as a bootstrap step).
- **FR-004**: Networking MUST include a VPC with public subnets (ALB) and private subnets (ECS tasks), plus an internet gateway. A NAT gateway MUST NOT be provisioned unless no alternative exists for required outbound access; VPC endpoints (S3 gateway endpoint for free S3 access; ECR API and ECR DKR interface endpoints for image pulls; CloudWatch Logs interface endpoint) are the preferred approach. If a NAT gateway is unavoidable, a single NAT gateway (one AZ) is the only permitted configuration.
- **FR-005**: The ECS cluster MUST use Fargate launch type for all tasks (no EC2 instances to manage).
- **FR-006**: The Redpanda Fargate task MUST mount an EFS volume at the Redpanda data directory so log segments survive container restarts.
- **FR-007**: The Redpanda Fargate task MUST have IAM permissions to write to the S3 Tiered Storage archive bucket.
- **FR-008**: The API Fargate task MUST have an ALB target group with a health check on `GET /health`, `interval=10`, `timeout=5`, `unhealthy_threshold=2`, `healthy_threshold=2`. The ALB MUST terminate HTTPS on port 443 using an ACM certificate; for environments without a custom domain, a Terraform-generated self-signed certificate imported into ACM is acceptable. HTTP port 80 MUST redirect to HTTPS.
- **FR-009**: The ECS task definition for the API MUST include an ECS-level health check: `["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]` with `startPeriod=30`, `interval=10`, `retries=6`, `timeout=5`.
- **FR-010**: One ECR repository MUST be provisioned for the API Docker image (`roster-api`) with image tag immutability enabled and scan-on-push enabled. The Redpanda image is pulled directly from Docker Hub and does not require an ECR repository.
- **FR-011**: The UI S3 bucket MUST be private; CloudFront MUST be the only origin accessor (Origin Access Control).
- **FR-012**: CloudFront MUST enforce HTTPS; HTTP requests MUST be redirected to HTTPS.
- **FR-013**: IAM roles MUST follow least-privilege: the API task role MUST NOT have write access to the S3 archive bucket; only the Redpanda task role has that permission.
- **FR-014**: Security groups MUST only allow necessary port access: ALB → API (8080), API → Redpanda (9092), Redpanda → S3 (HTTPS outbound via VPC endpoint or NAT), CloudFront → S3 (via OAC). ALB MUST accept HTTPS (443) and HTTP (80) from `0.0.0.0/0`; HTTP is only permitted for the redirect rule.
- **FR-016**: All container image references in ECS task definitions MUST use a specific pinned version tag (e.g., `v23.3.1`, `1.0.0`). The tag `latest` and any mutable floating tags are prohibited. The Redpanda Docker Hub image tag and the API ECR image tag MUST be declared as explicit Terraform variables with no default value (caller must supply them).
- **FR-015**: Terraform outputs MUST include: `api_url` (ALB DNS), `ui_url` (CloudFront URL), `ecr_api_repo` (ECR URI), `redpanda_endpoint` (internal DNS).

### Key Entities

- **VPC Module** (`infra/modules/networking`): VPC, subnets (2 public + 2 private), IGW, route tables. No NAT gateway.
- **ECS Cluster Module** (`infra/modules/ecs-cluster`): Fargate cluster, one ECR repository (`roster-api`), CloudWatch log group.
- **VPC Endpoints Module** (`infra/modules/vpc-endpoints`): S3 gateway endpoint (free), ECR API interface endpoint, ECR DKR interface endpoint, CloudWatch Logs interface endpoint; all scoped to the private subnets. Replaces the NAT gateway for all required outbound access.
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
- **SC-002**: The API is reachable at the ALB DNS over HTTPS within 5 minutes of `terraform apply` completing (assuming the API image is already in ECR). The ALB presents a valid (self-signed) TLS certificate.
- **SC-007**: No NAT gateway resource exists in the provisioned environment. All required outbound access from private subnets is served by VPC endpoints.
- **SC-008**: All container images in ECS task definitions reference a specific pinned version tag. `terraform plan` on a previously-applied environment produces zero changes (verifying tag immutability does not cause drift).
- **SC-003**: Redpanda data survives a Fargate task stop-and-restart (EFS persistence verified by reading committed offsets after restart).
- **SC-004**: The UI SPA loads over HTTPS at the CloudFront URL with no direct S3 URL exposure.
- **SC-005**: `terraform plan` on an already-applied environment shows zero changes (idempotency).
- **SC-006**: All infrastructure changes between environments are driven by Terraform variable overrides only; no module code duplication between dev and prod.

---

## Assumptions

- Terraform remote state S3 bucket and DynamoDB lock table are created manually as a one-time bootstrap step before `terraform init` is run.
- A Route 53 hosted zone and custom domain are out of scope for v1; ALB DNS and CloudFront domain names are used directly.
- HTTPS on the API ALB is provided via a Terraform-generated self-signed certificate imported into ACM. Browsers and automated tests must accept the cert with `-k` / `--insecure`; this is acceptable for dev/prod until a custom domain is added.
- Single Redpanda node (no cluster) is sufficient for v1 scale.
- The API Fargate task runs in private subnets. Outbound access (ECR image pull, CloudWatch Logs) is provided via VPC endpoints (S3 gateway endpoint + ECR API/DKR interface endpoints + CloudWatch Logs interface endpoint) — no NAT gateway required.
- The Redpanda Fargate task runs in a **public subnet** with `assign_public_ip = true`. This gives it direct internet access via the internet gateway (no NAT cost) so it can pull the `vectorized/redpanda` image from Docker Hub. Internal VPC routing keeps Redpanda reachable by the API task (port 9092) and able to mount EFS regardless of subnet placement. Security groups enforce that Kafka port 9092 is not publicly reachable.
- AWS region: `us-east-1` for all resources.
- Terraform version ≥ 1.6; AWS provider ≥ 5.0.

---

## Out of Scope

- Route 53 DNS and custom domain configuration.
- ACM certificate for a custom domain (a self-signed cert is used for v1).
- NAT gateway (not provisioned unless a future requirement forces it; requires spec update with justification).
- Multi-region deployment.
- Redpanda cluster (multi-node) configuration.
- CI/CD pipeline infrastructure (GitHub Actions workflows are in the application repo).
- Monitoring/alerting infrastructure (CloudWatch alarms, dashboards) — deferred to a future iteration.
- WAF or Shield configuration.
- Mirroring or caching public Docker Hub images in ECR.

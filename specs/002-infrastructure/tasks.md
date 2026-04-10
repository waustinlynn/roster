# Tasks: Infrastructure Provisioning

**Feature**: `002-infrastructure`
**Date**: 2026-03-21
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

> **Note**: All infrastructure tasks are in the `infra/` workspace only.
> Application code tasks (`api/`, `ui/`) are tracked in `specs/001-roster-management/tasks.md`.
> Bootstrap steps (S3 state bucket + DynamoDB table) are one-time manual operations documented
> in `infra/bootstrap/README.md` and are not Terraform-managed.
>
> **No NAT gateway** — API task uses VPC endpoints; Redpanda task runs in a public subnet.
> **All image tags are required Terraform variables** — no defaults, `latest` is prohibited.

---

## Dependencies

```
Phase 1 (Bootstrap) → Phase 2 (IAM)
                    → Phase 3 (US1: Networking + Cluster)
                              → Phase 4 (US2: Event Store + Redpanda) ─┐
                              → Phase 5 (US4: UI Hosting)              │  can run in parallel
                              → Phase 6 (US3: VPC Endpoints + API) ←───┘ (Phase 6 needs Phase 4)
                    → Phase 7 (Environments — compose all modules)
                    → Phase 8 (Validation)
```

Phases 4 and 5 can be worked in parallel after Phase 3.
Phase 6 depends on Phase 3 + Phase 4 (needs Redpanda SG + endpoint outputs).

---

## Phase 1: Bootstrap & Scaffold

> One-time setup, directory scaffolding, and remote state documentation.

- [ ] T001 Create `infra/` directory tree: `modules/` (networking, vpc-endpoints, ecs-cluster, api-service, redpanda-service, ui-hosting, event-store, iam), `environments/` (dev, prod), `bootstrap/`
- [ ] T002 Write `infra/bootstrap/README.md` with step-by-step instructions for manually creating the S3 state bucket (`roster-terraform-state-{suffix}`, versioning enabled) and DynamoDB lock table (`roster-terraform-locks`, PAY_PER_REQUEST) — this is the only manual AWS step in the entire deployment
- [ ] T003 [P] Create `infra/.terraform-version` pinning Terraform to `1.6`
- [ ] T004 [P] Create `infra/.gitignore` excluding `.terraform/`, `*.tfstate`, `*.tfstate.backup`, `*.tfplan`, `crash.log`

---

## Phase 2: IAM Module (Foundational — no story label)

> Shared ECS task execution role used by all ECS tasks. No other module dependencies.
> **⚠️ CRITICAL**: Must complete before any ECS-related user story phase begins.

- [ ] T005 Create `infra/modules/iam/variables.tf` with inputs: `env` (string), `aws_region` (string), `account_id` (string)
- [ ] T006 [P] Create `infra/modules/iam/main.tf` defining the ECS task execution role (`ecs-task-execution-{env}`) with `AmazonECSTaskExecutionRolePolicy` managed policy (allows ECR pull + CloudWatch Logs)
- [ ] T007 [P] Create `infra/modules/iam/outputs.tf` exporting `ecs_task_execution_role_arn`
- [ ] T008 [P] Create `infra/modules/iam/versions.tf` with `required_version = ">= 1.6"` and `required_providers { aws = { source = "hashicorp/aws", version = ">= 5.0" } }`

**Checkpoint**: IAM module complete — execution role ARN available as output for all service modules.

---

## Phase 3: User Story 1 — Networking & Core Cluster (Priority: P1) 🎯 MVP

**Goal**: `terraform apply` produces a working VPC (2 public + 2 private subnets, IGW), ECS Fargate cluster, and the `roster-api` ECR repository. No NAT gateway is created.

**Independent Test**: `terraform plan` produces zero errors; VPC, subnets, IGW, ECS cluster, and ECR repo appear in the AWS console; no NAT gateway resource exists.

### Networking Module

- [ ] T009 [US1] Create `infra/modules/networking/variables.tf` with inputs: `env` (string), `vpc_cidr` (default `10.0.0.0/16`), `public_subnet_cidrs` (list, default `["10.0.1.0/24","10.0.2.0/24"]`), `private_subnet_cidrs` (list, default `["10.0.11.0/24","10.0.12.0/24"]`), `availability_zones` (list)
- [ ] T010 [US1] Create `infra/modules/networking/main.tf` with:
  - `aws_vpc` (`roster-{env}`, enable DNS hostnames + resolution)
  - 2× `aws_subnet` public (`map_public_ip_on_launch = true`, AZ from var)
  - 2× `aws_subnet` private (`map_public_ip_on_launch = false`)
  - `aws_internet_gateway` attached to VPC
  - `aws_route_table` public (default route `0.0.0.0/0 → IGW`)
  - `aws_route_table` private (no default route — VPC endpoints will be added by vpc-endpoints module)
  - `aws_route_table_association` for all 4 subnets
  - **No** `aws_nat_gateway` or `aws_eip` resources
- [ ] T011 [P] [US1] Create `infra/modules/networking/outputs.tf` exporting `vpc_id`, `public_subnet_ids`, `private_subnet_ids`, `private_route_table_ids`
- [ ] T012 [P] [US1] Create `infra/modules/networking/versions.tf` with `required_version = ">= 1.6"` and `required_providers { aws = { source = "hashicorp/aws", version = ">= 5.0" } }`

### ECS Cluster Module

- [ ] T013 [P] [US1] Create `infra/modules/ecs-cluster/variables.tf` with inputs: `env` (string), `log_retention_days` (default `14`), `container_insights_enabled` (bool, default `false`)
- [ ] T014 [P] [US1] Create `infra/modules/ecs-cluster/main.tf` with:
  - `aws_ecs_cluster` (`roster-{env}`, Container Insights controlled by `var.container_insights_enabled`)
  - `aws_ecr_repository` (`roster-api`, `image_tag_mutability = "IMMUTABLE"`, `scan_on_push = true`)
  - `aws_cloudwatch_log_group` (`/ecs/roster-{env}`, `retention_in_days = var.log_retention_days`)
- [ ] T015 [P] [US1] Create `infra/modules/ecs-cluster/outputs.tf` exporting `cluster_arn`, `cluster_name`, `ecr_api_repo_url`, `log_group_name`
- [ ] T016 [P] [US1] Create `infra/modules/ecs-cluster/versions.tf` (same constraints as T012)

**Checkpoint**: US1 complete — `terraform plan` on networking + ecs-cluster modules shows expected resources with no NAT gateway. `aws ecr describe-repositories` returns `roster-api`.

---

## Phase 4: User Story 2 — Event Store + Redpanda Service (Priority: P2)

**Goal**: Redpanda Fargate task starts in a public subnet (pulls from Docker Hub), mounts EFS for data persistence, and is reachable on port 9092 by internal VPC traffic only.

**Independent Test**: After `terraform apply`, the Redpanda task is `RUNNING`; exec into the task and confirm the EFS mount is visible at `/var/lib/redpanda/data`; confirm port 9092 is NOT reachable from the public internet; confirm the task has a public IP (visible in ECS task details).

> Phases 4 and 5 (UI Hosting) can be worked in parallel — both only need Phase 3 complete.

### Event Store Module (parallelizable with Redpanda setup below)

- [ ] T017 [P] [US2] Create `infra/modules/event-store/variables.tf` with inputs: `env` (string), `aws_region` (string), `glacier_transition_days` (default `90`), `redpanda_task_role_arn` (string — set after Redpanda module creates the role; passed in from environment root)
- [ ] T018 [P] [US2] Create `infra/modules/event-store/main.tf` with:
  - `aws_s3_bucket` (`roster-events-archive-{env}`, `force_destroy = false`)
  - `aws_s3_bucket_versioning` (enabled)
  - `aws_s3_bucket_server_side_encryption_configuration` (AES256)
  - `aws_s3_bucket_public_access_block` (all four block settings = true)
  - `aws_s3_bucket_lifecycle_configuration` (transition to GLACIER after `var.glacier_transition_days` days)
  - `aws_s3_bucket_policy` allowing only `var.redpanda_task_role_arn` to `s3:PutObject`, `s3:GetObject`, `s3:ListBucket`, `s3:DeleteObject`
- [ ] T019 [P] [US2] Create `infra/modules/event-store/outputs.tf` exporting `bucket_name`, `bucket_arn`
- [ ] T020 [P] [US2] Create `infra/modules/event-store/versions.tf` (same constraints as T012)

### Redpanda Service Module

- [ ] T021 [US2] Create `infra/modules/redpanda-service/variables.tf` with inputs: `env`, `vpc_id`, `public_subnet_ids` (task placement), `private_subnet_ids` (EFS mount targets), `cluster_arn`, `cluster_name`, `ecs_task_execution_role_arn`, `log_group_name`, `event_store_bucket_name`, `event_store_bucket_arn`, `redpanda_image_tag` (**no default** — caller must supply), `cpu` (default `1024`), `memory` (default `2048`)
- [ ] T022 [US2] Create Redpanda IAM task role in `infra/modules/redpanda-service/main.tf`:
  - `aws_iam_role` (`roster-redpanda-task-{env}`, assume ECS tasks service principal)
  - `aws_iam_role_policy` granting `s3:PutObject`, `s3:GetObject`, `s3:ListBucket`, `s3:DeleteObject` on `${var.event_store_bucket_arn}` and `${var.event_store_bucket_arn}/*`
- [ ] T023 [US2] Create EFS resources in `infra/modules/redpanda-service/main.tf`:
  - `aws_efs_file_system` (`roster-redpanda-data-{env}`, lifecycle: `AFTER_7_DAYS` → infrequent access)
  - `aws_efs_access_point` (root path `/redpanda/data`, POSIX uid/gid 1000, creation_info permissions `0755`)
  - `aws_efs_mount_target` for each private subnet (Redpanda accesses EFS via intra-VPC routing even from its public subnet)
  - `aws_security_group` for EFS: allow inbound NFS (2049) from Redpanda task SG only; deny all else
- [ ] T024 [US2] Create Redpanda security group in `infra/modules/redpanda-service/main.tf`:
  - Inbound: allow Kafka (9092) from API task SG only (referenced via variable — wired in environment root)
  - Inbound: allow admin (9644) from within VPC CIDR only
  - Outbound: allow all (Docker Hub pull via IGW, S3 Tiered Storage uploads)
  - **No** inbound rules from `0.0.0.0/0`
- [ ] T025 [US2] Create ECS task definition, service, and Cloud Map service discovery in `infra/modules/redpanda-service/main.tf`:
  - `aws_service_discovery_private_dns_namespace` (`roster-{env}.local`)
  - `aws_service_discovery_service` (`redpanda`)
  - `aws_ecs_task_definition`: image = `vectorized/redpanda:${var.redpanda_image_tag}`; EFS volume mounted at `/var/lib/redpanda/data`; command includes `--overprovisioned --smp 1 --memory 512M --reserve-memory 0M --default-log-level=warn`; env vars: `REDPANDA_ADVERTISE_KAFKA_ADDR`, `CLOUD_STORAGE_ENABLED=true`, `CLOUD_STORAGE_REGION`, `CLOUD_STORAGE_BUCKET`, `CLOUD_STORAGE_CREDENTIALS_SOURCE=aws_instance_metadata`
  - `aws_ecs_service`: desired_count=1, launch_type=FARGATE, placed in `var.public_subnet_ids`, `assign_public_ip = true`, `health_check_grace_period_seconds = 60`, service registry pointing to Cloud Map service
- [ ] T026 [P] [US2] Create `infra/modules/redpanda-service/outputs.tf` exporting `redpanda_endpoint` (e.g., `redpanda.roster-dev.local:9092`), `redpanda_task_sg_id`, `redpanda_task_role_arn`, `efs_file_system_id`
- [ ] T027 [P] [US2] Create `infra/modules/redpanda-service/versions.tf` (same constraints as T012)

**Checkpoint**: US2 complete — Redpanda ECS service is `RUNNING`; EFS mount visible inside container; Kafka port 9092 reachable from within VPC but blocked from internet; Tiered Storage writes to S3 on segment roll.

---

## Phase 5: User Story 4 — UI Hosting (Priority: P4)

**Goal**: Static React SPA build artifacts served from S3 via CloudFront with HTTPS enforced, SPA routing (404→200), and cache invalidation support.

**Independent Test**: After `aws s3 sync dist/ s3://roster-ui-dev/`, `curl https://{cloudfront_url}/index.html` returns `200`. Direct S3 URL is inaccessible (403). `curl http://{cloudfront_url}` redirects to HTTPS.

> Can be built in parallel with Phase 4 — both only require Phase 3 complete.

- [ ] T028 [P] [US4] Create `infra/modules/ui-hosting/variables.tf` with inputs: `env` (string), `aws_region` (string)
- [ ] T029 [P] [US4] Create `infra/modules/ui-hosting/main.tf` with:
  - `aws_s3_bucket` (`roster-ui-{env}`, `force_destroy = true` for easy dev cleanup)
  - `aws_s3_bucket_versioning` (enabled)
  - `aws_s3_bucket_public_access_block` (all four block settings = true)
  - `aws_cloudfront_origin_access_control` (name `roster-ui-{env}-oac`, signing protocol SIGV4, signing behavior always, origin type S3)
  - `aws_cloudfront_distribution`: S3 origin with OAC; `default_root_object = "index.html"`; custom error response: error_code 404 → response_code 200, response_page_path `/index.html`; `viewer_protocol_policy = "redirect-to-https"`; `price_class = "PriceClass_100"` (US/EU only)
  - `aws_s3_bucket_policy` granting CloudFront service principal `s3:GetObject` on `${aws_s3_bucket.ui.arn}/*`
- [ ] T030 [P] [US4] Create `infra/modules/ui-hosting/outputs.tf` exporting `cloudfront_domain_name`, `s3_bucket_name`, `cloudfront_distribution_id`
- [ ] T031 [P] [US4] Create `infra/modules/ui-hosting/versions.tf` (same constraints as T012)

**Checkpoint**: US4 complete — CloudFront distribution `Deployed`; SPA loads over HTTPS; direct S3 URL returns 403; SPA routes return 200 (custom error response active).

---

## Phase 6: User Story 3 — VPC Endpoints + API Service (Priority: P3)

**Goal**: API Fargate task (private subnet) starts, pulls its image from ECR via VPC endpoints, passes the ALB health check at `GET /health` over HTTPS, and begins serving traffic only after aggregate replay completes.

**Independent Test**: `curl -k https://{alb_dns}/health` returns `200 {"status":"Healthy"}`; before replay completes the target returns `503`; `terraform plan` confirms no NAT gateway exists.

> Requires Phase 3 (networking, cluster) and Phase 4 (Redpanda) complete before starting.

### VPC Endpoints Module

- [ ] T032 [US3] Create `infra/modules/vpc-endpoints/variables.tf` with inputs: `env`, `vpc_id`, `private_subnet_ids`, `private_route_table_ids`, `aws_region` (string)
- [ ] T033 [US3] Create `infra/modules/vpc-endpoints/main.tf` with:
  - `aws_security_group` for interface endpoints: allow HTTPS (443) inbound from the API task SG (passed via variable); deny all else inbound; allow all outbound
  - `aws_vpc_endpoint` S3 gateway (`com.amazonaws.{region}.s3`, type Gateway, route table associations = `var.private_route_table_ids`) — **no hourly cost**
  - `aws_vpc_endpoint` ECR API interface (`com.amazonaws.{region}.ecr.api`, type Interface, private subnets, endpoint SG, `private_dns_enabled = true`)
  - `aws_vpc_endpoint` ECR DKR interface (`com.amazonaws.{region}.ecr.dkr`, same config as ECR API)
  - `aws_vpc_endpoint` CloudWatch Logs interface (`com.amazonaws.{region}.logs`, same config)
- [ ] T034 [P] [US3] Create `infra/modules/vpc-endpoints/outputs.tf` exporting `endpoint_sg_id`
- [ ] T035 [P] [US3] Create `infra/modules/vpc-endpoints/versions.tf` (same constraints as T012)

### API Service Module

- [ ] T036 [US3] Create `infra/modules/api-service/variables.tf` with inputs: `env`, `vpc_id`, `public_subnet_ids` (ALB placement), `private_subnet_ids` (task placement), `cluster_arn`, `ecs_task_execution_role_arn`, `log_group_name`, `ecr_api_repo_url`, `image_tag` (**no default** — caller must supply), `redpanda_endpoint`, `redpanda_task_sg_id`, `vpc_endpoint_sg_id`, `cpu` (default `512`), `memory` (default `1024`)
- [ ] T037 [US3] Create API IAM task role in `infra/modules/api-service/main.tf`:
  - `aws_iam_role` (`roster-api-task-{env}`, assume ECS tasks service principal)
  - Inline policy: CloudWatch Logs write only (`logs:CreateLogStream`, `logs:PutLogEvents` on `/ecs/roster-{env}/*`)
  - **No** S3 permissions — API MUST NOT have access to the event archive bucket (FR-013)
- [ ] T038 [US3] Create self-signed TLS certificate resources in `infra/modules/api-service/main.tf`:
  - `tls_private_key` (`roster-api-{env}`, algorithm RSA, rsa_bits 2048)
  - `tls_self_signed_cert` (valid 8760h, subject common_name `roster-api-{env}`, allowed_uses: key_encipherment, digital_signature, server_auth)
  - `aws_acm_certificate` (import: private_key + certificate_body from tls resources above)
- [ ] T039 [US3] Create ALB, listeners, target group, and ALB security group in `infra/modules/api-service/main.tf`:
  - `aws_security_group` for ALB: inbound HTTPS (443) + HTTP (80) from `0.0.0.0/0`; all outbound
  - `aws_lb` (internet-facing, `load_balancer_type = "application"`, public subnets, ALB SG)
  - `aws_lb_listener` HTTP:80 → redirect action (port 443, protocol HTTPS, status code HTTP_301)
  - `aws_lb_listener` HTTPS:443 → forward to target group; `ssl_policy = "ELBSecurityPolicy-TLS13-1-2-2021-06"`; `certificate_arn` from `aws_acm_certificate` above
  - `aws_lb_target_group` (type ip, port 8080, protocol HTTP; health_check: path `/health`, interval 10, timeout 5, healthy_threshold 2, unhealthy_threshold 2, matcher `200`)
- [ ] T040 [US3] Create API task security group in `infra/modules/api-service/main.tf`:
  - Inbound: allow 8080 from ALB SG only
  - Outbound: allow 9092 to Redpanda task SG (`var.redpanda_task_sg_id`)
  - Outbound: allow HTTPS (443) to VPC endpoint SG (`var.vpc_endpoint_sg_id`) — ECR pull + Logs
- [ ] T041 [US3] Create ECS task definition and service for the API in `infra/modules/api-service/main.tf`:
  - `aws_ecs_task_definition`: image = `${var.ecr_api_repo_url}:${var.image_tag}`; port 8080; env vars: `Redpanda__BootstrapServers = var.redpanda_endpoint`, `Redpanda__Topic = roster-events`, `ASPNETCORE_URLS = http://+:8080`; ECS health check `["CMD-SHELL","curl -f http://localhost:8080/health || exit 1"]` interval 10, timeout 5, retries 6, startPeriod 30
  - `aws_ecs_service`: desired_count=1, launch_type=FARGATE, private subnets, `assign_public_ip = false`, load balancer block pointing to target group, `health_check_grace_period_seconds = 60`
- [ ] T042 [P] [US3] Create `infra/modules/api-service/outputs.tf` exporting `alb_dns_name`, `api_task_sg_id`
- [ ] T043 [P] [US3] Create `infra/modules/api-service/versions.tf` with `required_providers { aws = { source = "hashicorp/aws", version = ">= 5.0" }, tls = { source = "hashicorp/tls", version = ">= 4.0" } }` and `required_version = ">= 1.6"`

**Checkpoint**: US3 complete — API ECS service `RUNNING`; `curl -k https://{alb_dns}/health` returns `{"status":"Healthy"}`; HTTP:80 redirects to HTTPS:443; no NAT gateway in VPC.

---

## Phase 7: Environment Root Modules

> Compose all child modules for `dev` and `prod`. Requires all module phases complete.

### Dev Environment

- [ ] T044 Create `infra/environments/dev/versions.tf` with:
  - `terraform { required_version = ">= 1.6"; backend "s3" { bucket = "roster-terraform-state-{suffix}"; key = "dev/terraform.tfstate"; region = "us-east-1"; dynamodb_table = "roster-terraform-locks" } }`
  - `required_providers { aws = { source = "hashicorp/aws", version = ">= 5.0" }, tls = { source = "hashicorp/tls", version = ">= 4.0" } }`
- [ ] T045 [P] Create `infra/environments/dev/variables.tf` declaring: `env`, `aws_region`, `api_image_tag` (**no default** — required), `redpanda_image_tag` (**no default** — required), `log_retention_days` (default 7), `glacier_transition_days` (default 90), `availability_zones` (default `["us-east-1a","us-east-1b"]`)
- [ ] T046 [P] Create `infra/environments/dev/terraform.tfvars` with: `env = "dev"`, `aws_region = "us-east-1"`, `log_retention_days = 7`, `glacier_transition_days = 90`, `availability_zones = ["us-east-1a","us-east-1b"]`
- [ ] T047 Create `infra/environments/dev/main.tf` composing all modules with correct output-to-input wiring:
  - `provider "aws" { region = var.aws_region }`
  - `module "iam"` → outputs: `ecs_task_execution_role_arn`
  - `module "networking"` → outputs: `vpc_id`, `public_subnet_ids`, `private_subnet_ids`, `private_route_table_ids`
  - `module "ecs_cluster"` (receives `env`, `log_retention_days`, `container_insights_enabled = false`) → outputs: `cluster_arn`, `cluster_name`, `ecr_api_repo_url`, `log_group_name`
  - `module "event_store"` (receives `env`, `aws_region`, `glacier_transition_days`, `redpanda_task_role_arn` — **use `null` initially; wired after redpanda module via `depends_on`**) → outputs: `bucket_name`, `bucket_arn`
  - `module "redpanda_service"` (receives networking + cluster outputs, `event_store_bucket_*`, `redpanda_image_tag = var.redpanda_image_tag`) → outputs: `redpanda_endpoint`, `redpanda_task_sg_id`, `redpanda_task_role_arn`
  - Update `module "event_store"` bucket policy with `redpanda_task_role_arn` from redpanda module output (use `depends_on = [module.redpanda_service]`)
  - `module "vpc_endpoints"` (receives `vpc_id`, `private_subnet_ids`, `private_route_table_ids`, `aws_region`) → outputs: `endpoint_sg_id`
  - `module "api_service"` (receives networking + cluster + redpanda + vpc_endpoints outputs, `image_tag = var.api_image_tag`) → outputs: `alb_dns_name`
  - `module "ui_hosting"` (receives `env`, `aws_region`)
- [ ] T048 [P] Create `infra/environments/dev/outputs.tf` with all FR-015 required outputs: `api_url = module.api_service.alb_dns_name`, `ui_url = module.ui_hosting.cloudfront_domain_name`, `ecr_api_repo = module.ecs_cluster.ecr_api_repo_url`, `redpanda_endpoint = module.redpanda_service.redpanda_endpoint`

### Prod Environment

- [ ] T049 [P] Create `infra/environments/prod/versions.tf` (same as dev but key = `"prod/terraform.tfstate"`)
- [ ] T050 [P] Create `infra/environments/prod/variables.tf` + `terraform.tfvars` with prod overrides: `env = "prod"`, `log_retention_days = 30`, `glacier_transition_days = 30`, `redpanda_cpu = 2048`, `redpanda_memory = 4096`, `container_insights_enabled = true`
- [ ] T051 [P] Create `infra/environments/prod/main.tf` mirroring dev, with prod-specific differences: `container_insights_enabled = true` passed to `module "ecs_cluster"`, higher Redpanda CPU/memory
- [ ] T052 [P] Create `infra/environments/prod/outputs.tf` (identical structure to dev outputs)

---

## Phase 8: Validation & Documentation

- [ ] T053 Run `terraform validate` in `infra/environments/dev` and fix any errors (all modules must pass validation before continuing)
- [ ] T054 Run `terraform plan -var="api_image_tag=placeholder" -var="redpanda_image_tag=placeholder"` in `infra/environments/dev` (requires AWS credentials) — confirm zero errors; review plan output for expected resource count (~45–55 resources including VPC endpoints); confirm no `aws_nat_gateway` in plan
- [ ] T055 Run `terraform apply` in `infra/environments/dev` with real image tags and verify all acceptance scenarios from spec.md US1–US4 using the quickstart.md verification steps
- [ ] T056 Verify SC-007 — run `aws ec2 describe-nat-gateways --filter "Name=tag:env,Values=dev"` and confirm empty result (no NAT gateway created)
- [ ] T057 Run `terraform plan` on the already-applied dev environment (with same image tag vars) and confirm zero changes — verifies idempotency (SC-005) and that pinned image tags cause no drift (SC-008)
- [ ] T058 Update `specs/002-infrastructure/quickstart.md` Infrastructure section with actual Terraform output values (`api_url`, `ui_url`, `ecr_api_repo`) after successful apply

---

## Parallel Execution Guide

```
T001–T004 (bootstrap, some parallel)
   └─→ T005–T008 (iam, mostly parallel)
   └─→ T009–T012 (networking)
         └─→ T013–T016 (ecs-cluster, all parallel)
                                                     ┌─ T017–T020 (event-store, all [P]) ─┐
                                                     ├─ T021–T027 (redpanda-service)       │
                                                     │                                      │
                                                     └─ T028–T031 (ui-hosting, all [P]) ───┤
                                                                                            │
                                               T032–T035 (vpc-endpoints) ──────────────────┤
                                               T036–T043 (api-service) ────────────────────┘
                                                                                            │
   All modules complete → T044–T052 (environments) ─────────────────────────────────────────┘
                       → T053–T058 (validation)
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 — Bootstrap | T001–T004 | Directory scaffolding, .gitignore, version pin, bootstrap docs |
| 2 — IAM | T005–T008 | ECS task execution role (shared by all tasks) |
| 3 — US1 Networking + Cluster | T009–T016 | VPC (no NAT), ECS cluster, ECR roster-api |
| 4 — US2 Event Store + Redpanda | T017–T027 | S3 archive, Redpanda Fargate (public subnet) + EFS |
| 5 — US4 UI Hosting | T028–T031 | S3 + CloudFront + OAC (parallel with Phase 4) |
| 6 — US3 VPC Endpoints + API | T032–T043 | VPC endpoints, API Fargate (private), ALB HTTPS |
| 7 — Environments | T044–T052 | Dev + prod root module composition |
| 8 — Validation | T053–T058 | validate, plan, apply, smoke tests, idempotency |

**Total tasks**: 58
**Parallelizable**: Event Store (T017–T020) + UI Hosting (T028–T031) run in parallel with each other and with early Redpanda setup; ECS Cluster tasks (T013–T016) all parallel; most output/versions files parallel within their module.

**No TDD phase**: Terraform has no unit test framework in scope for v1 (noted in plan.md Constitution Check). Acceptance is via `terraform plan` + manual smoke tests (T053–T058).

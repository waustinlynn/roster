# Tasks: Infrastructure Provisioning

**Feature**: `002-infrastructure`
**Date**: 2026-03-17
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

> **Note**: All infrastructure tasks are in the `infra/` workspace only.
> Application code tasks (`api/`, `ui/`) are tracked in `specs/001-roster-management/tasks.md`.
> Bootstrap steps (S3 state bucket + DynamoDB table) are one-time manual operations documented
> in `infra/bootstrap/README.md` and are not Terraform-managed.

---

## Dependencies

```
Phase 1 (Bootstrap) → Phase 2 (IAM + Networking) → Phase 3 (Cluster + Repos)
                                                  → Phase 4 (Event Store)
                                                  → Phase 5 (Redpanda Service)
                                                  → Phase 6 (API Service)
                                                  → Phase 7 (UI Hosting)
                                                  → Phase 8 (Environments)
```

Phases 4 and 7 can be worked in parallel after Phase 3.
Phases 5 and 6 must be sequential (Redpanda before API).

---

## Phase 1: Bootstrap & Scaffold

> One-time setup, directory scaffolding, and remote state documentation.

- [ ] T001 Create `infra/` directory tree: `modules/` (networking, ecs-cluster, api-service, redpanda-service, ui-hosting, event-store, iam), `environments/` (dev, prod), `bootstrap/`
- [ ] T002 Write `infra/bootstrap/README.md` with step-by-step instructions for manually creating the S3 state bucket (`roster-terraform-state-{suffix}`, versioning enabled) and DynamoDB lock table (`roster-terraform-locks`, PAY_PER_REQUEST)
- [ ] T003 Create root `.terraform-version` file pinning Terraform to `1.6` in `infra/`
- [ ] T004 Create `infra/.gitignore` excluding `.terraform/`, `*.tfstate`, `*.tfstate.backup`, `*.tfplan`, `crash.log`

---

## Phase 2: IAM Module

> Shared IAM policies and execution role used by all ECS tasks. No dependencies.

- [ ] T005 Create `infra/modules/iam/variables.tf` with inputs: `env` (string), `aws_region` (string), `account_id` (string)
- [ ] T006 [P] Create `infra/modules/iam/main.tf` defining the ECS task execution role (`ecs-task-execution-{env}`) with the `AmazonECSTaskExecutionRolePolicy` managed policy (allows ECR pull + CloudWatch Logs)
- [ ] T007 [P] Create `infra/modules/iam/outputs.tf` exporting `ecs_task_execution_role_arn`

---

## Phase 3: Networking Module

> VPC, subnets, IGW, NAT gateway, route tables. All other modules depend on this.

- [ ] T008 Create `infra/modules/networking/variables.tf` with inputs: `env` (string), `vpc_cidr` (default `10.0.0.0/16`), `public_subnet_cidrs` (list, default `["10.0.1.0/24","10.0.2.0/24"]`), `private_subnet_cidrs` (list, default `["10.0.11.0/24","10.0.12.0/24"]`), `availability_zones` (list)
- [ ] T009 Create `infra/modules/networking/main.tf` with:
  - `aws_vpc` resource (`roster-{env}`, enable DNS hostnames + resolution)
  - 2× `aws_subnet` public (map public IP on launch)
  - 2× `aws_subnet` private
  - `aws_internet_gateway`
  - `aws_eip` + `aws_nat_gateway` (in first public subnet)
  - `aws_route_table` public (default route → IGW) + private (default route → NAT)
  - `aws_route_table_association` for all 4 subnets
- [ ] T010 Create `infra/modules/networking/outputs.tf` exporting `vpc_id`, `public_subnet_ids`, `private_subnet_ids`, `nat_gateway_id`

---

## Phase 4: ECS Cluster Module

> Fargate cluster, ECR repository, CloudWatch log group.

- [ ] T011 Create `infra/modules/ecs-cluster/variables.tf` with inputs: `env` (string), `log_retention_days` (default `14`)
- [ ] T012 Create `infra/modules/ecs-cluster/main.tf` with:
  - `aws_ecs_cluster` (`roster-{env}`, Container Insights disabled for cost in dev)
  - `aws_ecr_repository` (`roster-api`, `image_tag_mutability = "IMMUTABLE"`, scan on push enabled)
  - `aws_cloudwatch_log_group` (`/ecs/roster-{env}`, retention_in_days = var.log_retention_days)
- [ ] T013 Create `infra/modules/ecs-cluster/outputs.tf` exporting `cluster_arn`, `cluster_name`, `ecr_api_repo_url`, `log_group_name`

---

## Phase 5: Event Store Module

> S3 bucket for Redpanda Tiered Storage archive. Can be built in parallel with Phase 4.

- [ ] T014 [P] Create `infra/modules/event-store/variables.tf` with inputs: `env` (string), `aws_region` (string), `glacier_transition_days` (default `90`)
- [ ] T015 [P] Create `infra/modules/event-store/main.tf` with:
  - `aws_s3_bucket` (`roster-events-archive-{env}`, force_destroy = false)
  - `aws_s3_bucket_versioning` (enabled)
  - `aws_s3_bucket_server_side_encryption_configuration` (AES256)
  - `aws_s3_bucket_public_access_block` (all four block settings = true)
  - `aws_s3_bucket_lifecycle_configuration` (transition to GLACIER after `glacier_transition_days`)
  - `aws_s3_bucket_policy` allowing only the Redpanda task role to `s3:PutObject`, `s3:GetObject`, `s3:ListBucket`, `s3:DeleteObject`
- [ ] T016 [P] Create `infra/modules/event-store/outputs.tf` exporting `bucket_name`, `bucket_arn`

---

## Phase 6: Redpanda Service Module

> ECS Fargate task for Redpanda with EFS mount for hot log segment persistence.
> Depends on: networking, ecs-cluster, event-store, iam.

- [ ] T017 Create `infra/modules/redpanda-service/variables.tf` with inputs: `env`, `vpc_id`, `private_subnet_ids`, `cluster_arn`, `cluster_name`, `ecs_task_execution_role_arn`, `log_group_name`, `event_store_bucket_name`, `event_store_bucket_arn`, `redpanda_image` (default `vectorized/redpanda:latest`), `cpu` (default `1024`), `memory` (default `2048`)
- [ ] T018 Create Redpanda IAM task role in `infra/modules/redpanda-service/main.tf`:
  - `aws_iam_role` (`roster-redpanda-task-{env}`, assume ECS tasks)
  - `aws_iam_role_policy` granting `s3:PutObject`, `s3:GetObject`, `s3:ListBucket`, `s3:DeleteObject` on `event_store_bucket_arn/*`
- [ ] T019 Create EFS resources in `infra/modules/redpanda-service/main.tf`:
  - `aws_efs_file_system` (`roster-redpanda-data-{env}`, lifecycle: `AFTER_7_DAYS`)
  - `aws_efs_access_point` (path `/redpanda/data`, posix uid/gid 1000, permissions 755)
  - `aws_efs_mount_target` for each private subnet
  - Security group for EFS: allow NFS (2049) inbound from Redpanda task SG only
- [ ] T020 Create Redpanda security group in `infra/modules/redpanda-service/main.tf`:
  - Allow inbound Kafka (9092) from API task SG
  - Allow inbound admin (9644) from within VPC only
  - Allow all outbound (for S3 Tiered Storage uploads via NAT)
- [ ] T021 Create ECS task definition and service for Redpanda in `infra/modules/redpanda-service/main.tf`:
  - `aws_ecs_task_definition`: container uses EFS volume mount at `/var/lib/redpanda/data`; command includes `--overprovisioned --smp 1 --memory 512M --reserve-memory 0M --default-log-level=warn`; env vars for Tiered Storage (`CLOUD_STORAGE_ENABLED=true`, bucket, region, credentials source = `aws_instance_metadata`)
  - `aws_ecs_service`: desired_count = 1, launch_type = FARGATE, private subnets, assign public IP = false; health_check_grace_period = 60
  - `aws_service_discovery_private_dns_namespace` + `aws_service_discovery_service` for internal DNS (`redpanda.roster-{env}.local:9092`)
- [ ] T022 Create `infra/modules/redpanda-service/outputs.tf` exporting `redpanda_endpoint` (e.g., `redpanda.roster-dev.local:9092`), `redpanda_task_sg_id`, `efs_file_system_id`

---

## Phase 7: API Service Module

> ECS Fargate task for the ASP.NET Core API, ALB, target group with health check.
> Depends on: networking, ecs-cluster, iam, redpanda-service (for endpoint + SG reference).

- [ ] T023 Create `infra/modules/api-service/variables.tf` with inputs: `env`, `vpc_id`, `public_subnet_ids`, `private_subnet_ids`, `cluster_arn`, `ecs_task_execution_role_arn`, `log_group_name`, `ecr_api_repo_url`, `image_tag` (default `latest`), `redpanda_endpoint`, `redpanda_task_sg_id`, `cpu` (default `512`), `memory` (default `1024`)
- [ ] T024 Create API IAM task role in `infra/modules/api-service/main.tf`:
  - `aws_iam_role` (`roster-api-task-{env}`, assume ECS tasks)
  - Minimal permissions: CloudWatch Logs write only (no S3 access — API does not write to archive)
- [ ] T025 Create ALB and security groups in `infra/modules/api-service/main.tf`:
  - `aws_lb` (internet-facing, public subnets)
  - ALB SG: allow HTTP (80) and HTTPS (443) inbound from `0.0.0.0/0`; all outbound
  - `aws_lb_listener` HTTP:80 → redirect to HTTPS:443
  - `aws_lb_listener` HTTPS:443 → forward to target group (no ACM cert in v1 — use HTTP:8080 listener directly for dev)
  - `aws_lb_target_group`: type = ip, port 8080, protocol HTTP; health_check: path `/health`, interval 10, timeout 5, healthy_threshold 2, unhealthy_threshold 2, matcher `200`
- [ ] T026 Create API security group in `infra/modules/api-service/main.tf`:
  - Inbound: allow 8080 from ALB SG
  - Outbound: allow 9092 to Redpanda task SG; allow HTTPS (443) outbound for ECR image pull (via NAT)
- [ ] T027 Create ECS task definition and service for the API in `infra/modules/api-service/main.tf`:
  - `aws_ecs_task_definition`: image = `{ecr_api_repo_url}:{image_tag}`; port 8080; env vars: `Redpanda__BootstrapServers`, `Redpanda__Topic=roster-events`, `ASPNETCORE_URLS=http://+:8080`
  - ECS health check: `["CMD-SHELL","curl -f http://localhost:8080/health || exit 1"]`, interval 10, timeout 5, retries 6, startPeriod 30
  - `aws_ecs_service`: desired_count = 1, launch_type = FARGATE, private subnets, load balancer integration with target group
- [ ] T028 Create `infra/modules/api-service/outputs.tf` exporting `alb_dns_name`, `api_task_sg_id`

---

## Phase 8: UI Hosting Module

> S3 bucket (private) + CloudFront distribution with OAC.
> Can be built in parallel with Phases 6–7.

- [ ] T029 [P] Create `infra/modules/ui-hosting/variables.tf` with inputs: `env`, `aws_region`
- [ ] T030 [P] Create `infra/modules/ui-hosting/main.tf` with:
  - `aws_s3_bucket` (`roster-ui-{env}`, force_destroy = true for dev)
  - `aws_s3_bucket_versioning` (enabled)
  - `aws_s3_bucket_public_access_block` (all block settings = true)
  - `aws_cloudfront_origin_access_control` (OAC, signing protocol SIGV4, signing behavior always, origin type S3)
  - `aws_cloudfront_distribution`: S3 origin with OAC; default_root_object = `index.html`; custom error response: error_code 404 → response_code 200, response_page_path `/index.html`; viewer protocol policy = `redirect-to-https`; price_class = `PriceClass_100` (US/EU only, cheapest)
  - `aws_s3_bucket_policy` allowing CloudFront service principal to `s3:GetObject` on bucket ARN
- [ ] T031 [P] Create `infra/modules/ui-hosting/outputs.tf` exporting `cloudfront_domain_name`, `s3_bucket_name`, `cloudfront_distribution_id`

---

## Phase 9: Environment Root Modules

> Compose all modules in `dev` and `prod` environments with per-environment variable overrides.

- [ ] T032 Create `infra/environments/dev/main.tf` composing all modules:
  - Backend block: S3 state bucket, key = `dev/terraform.tfstate`, DynamoDB lock table
  - `module "iam"` → `module "networking"` → `module "ecs_cluster"` → `module "event_store"` → `module "redpanda_service"` → `module "api_service"` → `module "ui_hosting"`
  - Wire outputs from each module as inputs to dependent modules
- [ ] T033 Create `infra/environments/dev/variables.tf` + `terraform.tfvars` with dev overrides:
  - `env = "dev"`, `aws_region = "us-east-1"`, `log_retention_days = 7`, `glacier_transition_days = 90`
- [ ] T034 Create `infra/environments/dev/outputs.tf` with required outputs per FR-015:
  - `api_url` (ALB DNS), `ui_url` (CloudFront domain), `ecr_api_repo` (ECR URI), `redpanda_endpoint` (internal DNS)
- [ ] T035 Create `infra/environments/prod/main.tf` mirroring dev but with prod-appropriate defaults (Container Insights enabled, multi-AZ NAT, higher log retention)
- [ ] T036 Create `infra/environments/prod/variables.tf` + `terraform.tfvars` with prod overrides:
  - `env = "prod"`, `log_retention_days = 30`, `glacier_transition_days = 30`, `redpanda_cpu = 2048`, `redpanda_memory = 4096`
- [ ] T037 Create `infra/environments/prod/outputs.tf` (same outputs as dev)

---

## Phase 10: Validation & Documentation

- [ ] T038 Run `terraform validate` in `infra/environments/dev` and fix any errors
- [ ] T039 Run `terraform plan` in `infra/environments/dev` (requires AWS credentials) — confirm zero errors and plan output matches expected resource count (~35–45 resources)
- [ ] T040 Run `terraform apply` in `infra/environments/dev` and verify all acceptance scenarios from spec.md US1–US4
- [ ] T041 Update `specs/001-roster-management/quickstart.md` (Infrastructure section) with actual Terraform state bucket name and correct `terraform apply` output values (api_url, ui_url, ecr_api_repo)
- [ ] T042 Run `terraform plan` on already-applied dev environment and confirm zero changes (idempotency — SC-005)

---

## Parallel Execution Guide

```
T001–T004 (bootstrap)
   └─→ T005–T007 (iam) ──────────────────────────────────────────────┐
   └─→ T008–T010 (networking) ────────────────────────────────────────┤
         └─→ T011–T013 (ecs-cluster) ──────────────────────────────────┤
                                                                        │
               T014–T016 (event-store) [parallel with ecs-cluster] ────┤
               T029–T031 (ui-hosting)  [parallel with event-store] ────┤
                                                                        │
         └─→ T017–T022 (redpanda-service) ─────────────────────────────┤
               └─→ T023–T028 (api-service) ─────────────────────────────┤
                                                                        │
   All modules complete → T032–T037 (environments) ────────────────────┘
                        → T038–T042 (validation)
```

---

## Summary

| Phase | Tasks | Description |
|---|---|---|
| 1 — Bootstrap | T001–T004 | Directory scaffolding, .gitignore, version pin, bootstrap docs |
| 2 — IAM | T005–T007 | ECS task execution role |
| 3 — Networking | T008–T010 | VPC, subnets, IGW, NAT |
| 4 — Cluster | T011–T013 | ECS cluster, ECR, CloudWatch log group |
| 5 — Event Store | T014–T016 | S3 archive bucket (Tiered Storage target) |
| 6 — Redpanda | T017–T022 | Fargate task + EFS + Service Discovery + SG |
| 7 — API Service | T023–T028 | Fargate task + ALB + health check + SG |
| 8 — UI Hosting | T029–T031 | S3 + CloudFront + OAC |
| 9 — Environments | T032–T037 | Dev + prod root module composition |
| 10 — Validation | T038–T042 | terraform validate, plan, apply, idempotency |

**Total tasks**: 42
**Parallelizable**: Event Store (T014–T016) and UI Hosting (T029–T031) can be built alongside ECS Cluster tasks. IAM and Networking can be built in parallel after bootstrap.

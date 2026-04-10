# roster Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-21

## Active Technologies

- C# / .NET 10 (API), TypeScript / React + Vite latest (UI) (001-roster-management)
- Terraform ≥ 1.6, AWS Provider ≥ 5.0, Terraform TLS provider ≥ 4.0 (002-infrastructure)

## Project Structure

```text
ui/          # React + Vite SPA; orval-generated client in ui/src/api/
api/         # .NET 10 solution: Roster.Domain / Application / Infrastructure / Api
infra/       # Terraform — single root; modules/ + envs/ (per-env .tfvars + .backend.hcl)
specs/       # Feature specs, plans, data models, contracts
```

## Commands

```bash
# API
dotnet restore api/
dotnet test api/Roster.sln
dotnet watch run --project api/Roster.Api

# UI
npm install --prefix ui
npm run generate-client --prefix ui   # regenerate orval client from OpenAPI spec
npm run dev --prefix ui
npm test --prefix ui

# Infra — single root, per-env var files; always supply pinned image tags
cd infra
terraform init -backend-config=envs/dev.backend.hcl          # once per checkout / env switch
terraform plan  -var-file=envs/dev.tfvars -var="api_image_tag=<version>" -var="redpanda_image_tag=<version>"
terraform apply -var-file=envs/dev.tfvars -var="api_image_tag=<version>" -var="redpanda_image_tag=<version>"
# Switch to prod: terraform init -reconfigure -backend-config=envs/prod.backend.hcl
```

## Code Style

- **C#**: Follow .NET conventions; use file-scoped namespaces; prefer records for value
  objects and domain events; use `sealed` on records; async/await throughout.
- **TypeScript**: Strict mode; functional components; no `any`; TanStack Query for all
  server state; generated client in `ui/src/api/` is read-only (do not hand-edit).
- **Terraform**: snake_case resource names; tag all resources with `env` and `project`;
  every module must have `versions.tf` with explicit `required_providers` and
  `required_version`; never use `latest` image tags in task definitions.

## Infrastructure Notes (002)

- **No NAT gateway**: API task uses VPC endpoints (ECR, Logs); Redpanda task runs in a
  public subnet with `assign_public_ip = true` to pull from Docker Hub via IGW.
- **HTTPS on ALB**: Uses a Terraform-generated self-signed cert imported into ACM. Use
  `-k` / `--insecure` with curl until a real cert is attached.
- **Pinned image tags**: `api_image_tag` and `redpanda_image_tag` are required Terraform
  variables with no defaults. Supply them on every `terraform plan/apply`.

## Recent Changes

- 001-roster-management: Added C# / .NET 10 (API), TypeScript / React + Vite latest (UI)
- 002-infrastructure: Added Terraform infra (ECS Fargate, ALB HTTPS, EFS, S3, CloudFront, VPC endpoints)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

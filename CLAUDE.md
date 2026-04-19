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

## Architecture & Coding Standards (from Constitution v1.0.0)

### DDD Layer Rules
Dependency direction flows inward only: `Api → Infrastructure → Application → Domain`.

| Project | Responsibility | May depend on |
|---|---|---|
| `Roster.Domain` | Entities, value objects, domain events, interfaces | Nothing |
| `Roster.Application` | Commands/queries (CQRS), use cases | Domain |
| `Roster.Infrastructure` | Event store, repositories, external services | Application, Domain |
| `Roster.Api` | Controllers, middleware, DI wiring, OpenAPI | Application, Infrastructure |

Domain must never reference infrastructure concerns. All cross-layer contracts are interfaces defined in the inner layer, implemented in the outer layer.

### SOLID (API)
- **S**: Each class has one reason to change.
- **O**: Open for extension, closed for modification.
- **L**: Subtypes substitutable for base types.
- **I**: Small focused interfaces; clients never depend on methods they don't use.
- **D**: Depend on abstractions; all dependencies resolved via .NET DI container.

### TDD (NON-NEGOTIABLE for Domain & Application layers)
1. Write a failing test encoding the requirement — get team approval it is correct.
2. Confirm RED. Then implement the minimum code to go GREEN.
3. Refactor under GREEN.

Committing implementation before the corresponding test exists is a constitution violation. Test categories: **unit** (Domain/Application, no I/O), **integration** (Infrastructure against real emulator), **contract** (API endpoints vs OpenAPI schema).

### OpenAPI-First
- OpenAPI auto-generated from code annotations (Swashbuckle); no manually maintained spec files.
- Every endpoint must have `[ProducesResponseType]` for all relevant status codes.
- UI client must be generated from the spec via `npm run generate-client`. Hand-written fetch wrappers against the Roster API are prohibited.
- Bare `fetch`/`axios` calls to the API outside of TanStack Query hooks are prohibited.

### Frontend Data Layer
- All server state via TanStack Query (`useQuery`, `useMutation`) using the generated client.
- Cache invalidation must be deliberate and defined in the relevant hook file.
- Local UI state (forms, modals) may use React state primitives.

### Infrastructure as Code
- All AWS resources provisioned exclusively via Terraform in `infra/`; no console/CLI drift.
- Remote state via S3 backend + DynamoDB lock from project inception.
- Destructive plan operations require explicit human approval before `terraform apply`.

### Commit Convention
Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `infra:`.

### Branch Strategy
- `main` — always deployable; merges via PR only.
- `feature/<issue>-<short-description>` — feature work; rebased onto `main` before merge.
- `infra/<description>` — infrastructure-only changes.

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

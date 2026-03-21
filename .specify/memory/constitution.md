<!--
SYNC IMPACT REPORT
==================
Version change: [unversioned template] → 1.0.0
Bump type: MINOR (initial ratification — all principles are new content)

Modified principles: none (first ratification)

Added sections:
  - Core Principles (7 principles: Monorepo Structure, DDD, SOLID, TDD, OpenAPI-First,
    Infrastructure as Code, Frontend Data Layer)
  - Technology Stack
  - Development Workflow
  - Governance

Removed sections: none

Templates updated:
  ✅ .specify/memory/constitution.md          — ratified (this file)
  ✅ .specify/templates/plan-template.md      — Constitution Check gates updated
  ✅ .specify/templates/tasks-template.md     — Path Conventions updated with monorepo + DDD layout
  ✅ .specify/templates/spec-template.md      — no changes required (template is sufficiently generic)
  ✅ .specify/templates/agent-file-template.md — no changes required

Deferred TODOs: none
-->

# Roster Constitution

## Core Principles

### I. Monorepo Structure

All source code, infrastructure configuration, and documentation MUST reside in a single
repository organized into three top-level workspaces:

- `ui/` — React + Vite frontend application
- `api/` — .NET 10 backend solution (four DDD projects)
- `infra/` — Terraform modules and state configuration targeting AWS

No workspace may import directly from another workspace's internal source tree.
Cross-workspace communication occurs exclusively through published artifacts or deployed
endpoints. The repository root MUST contain workspace-aware tooling configuration
(e.g., `package.json` workspaces, `.sln` solution file, `.editorconfig`).

**Rationale**: A monorepo enables atomic cross-cutting changes, unified CI/CD, and a single
source of truth while preserving clear ownership boundaries between UI, API, and infra
concerns.

### II. Domain-Driven Design (API)

The API solution MUST be structured as exactly four projects following DDD layering rules:

| Project | Responsibility | May depend on |
|---|---|---|
| `Roster.Domain` | Entities, value objects, domain events, interfaces | Nothing |
| `Roster.Application` | Use cases, commands/queries (CQRS), application services | Domain |
| `Roster.Infrastructure` | EF Core, external services, repository implementations | Application, Domain |
| `Roster.Api` | Controllers, OpenAPI config, DI wiring, middleware | Application, Infrastructure |

Dependency direction MUST flow inward (Api → Infrastructure → Application → Domain).
No project may reference a project in a more outward layer. Domain MUST NOT reference any
infrastructure concern. All cross-layer contracts MUST be expressed as interfaces defined in
the inner layer and implemented in the outer layer.

**Rationale**: DDD layering enforces separation of concerns, makes domain logic testable
in isolation, and prevents framework leakage into business logic.

### III. SOLID Principles

All API code MUST adhere to SOLID principles:

- **S** — Single Responsibility: each class MUST have one reason to change.
- **O** — Open/Closed: classes MUST be open for extension, closed for modification.
- **L** — Liskov Substitution: subtypes MUST be substitutable for their base types.
- **I** — Interface Segregation: clients MUST NOT depend on interfaces they do not use;
  prefer small, focused interfaces.
- **D** — Dependency Inversion: high-level modules MUST depend on abstractions, not
  concretions. All dependencies MUST be registered with and resolved by the .NET DI
  container.

Code review MUST flag any SOLID violation before merging.

**Rationale**: SOLID disciplines prevent coupling, improve testability, and ensure the
codebase remains maintainable as feature complexity grows.

### IV. Test-Driven Development (NON-NEGOTIABLE)

TDD is MANDATORY for all API business logic (Domain and Application layers):

1. Write a failing test that captures the desired behaviour.
2. Obtain team approval that the test correctly encodes the requirement.
3. Confirm the test is RED (fails with the expected failure).
4. Implement the minimum code to make the test GREEN.
5. Refactor under GREEN.

The Red-Green-Refactor cycle MUST NOT be skipped or reversed. Committing implementation
code before the corresponding test exists is a constitution violation.

Test categories MUST include:

- **Unit tests** — Domain and Application layer logic in isolation (no I/O).
- **Integration tests** — Infrastructure layer against a test database/emulator.
- **Contract tests** — API endpoints validated against the published OpenAPI schema.

All test projects MUST reside alongside their target project (e.g., `Roster.Domain.Tests`).

**Rationale**: TDD is the primary mechanism for living documentation, regression safety, and
design feedback. Skipping it produces code that is harder to understand and extend.

### V. OpenAPI-First Contract

The `Roster.Api` project MUST enable OpenAPI documentation from the first commit:

- OpenAPI MUST be auto-generated from code annotations (Swashbuckle or NSwag);
  no manually maintained spec files are permitted.
- Every endpoint MUST carry explicit `[ProducesResponseType]` annotations covering all
  relevant response codes.
- The OpenAPI spec MUST be exported as a static JSON/YAML artefact on each CI build.
- The `ui/` workspace MUST generate its API client from that artefact using a
  code-generation tool (e.g., `orval` or `openapi-typescript-codegen`).
  Hand-written fetch wrappers targeting the Roster API are prohibited.

**Rationale**: An auto-generated contract eliminates drift between the API and consuming
client, reduces integration bugs, and provides always-accurate documentation for free.

### VI. Infrastructure as Code

All AWS infrastructure MUST be provisioned exclusively through Terraform modules in `infra/`:

- No resource MUST be created or modified via the AWS Management Console or AWS CLI
  outside of Terraform-managed state.
- Remote state MUST be configured (S3 backend + DynamoDB lock table) from project inception.
- Every Terraform module MUST declare explicit provider version constraints.
- Destructive plan operations (`destroy`, forced replacements) MUST require explicit human
  approval in CI before `terraform apply` executes.

**Rationale**: IaC ensures reproducible, auditable, version-controlled infrastructure.
Console drift introduces untracked risk and makes disaster recovery unreliable.

### VII. Frontend Data Layer

The `ui/` application MUST manage all server state through TanStack Query:

- All API calls MUST be made via the generated OpenAPI client wrapped in TanStack Query
  hooks (`useQuery`, `useMutation`).
- Bare `fetch` or `axios` calls directly to the Roster API outside of TanStack Query
  hooks are prohibited.
- Cache invalidation strategies MUST be deliberate and documented in the relevant hook
  or service file.
- Local UI state (form state, modal toggles, etc.) is exempt and may use React state
  primitives.

**Rationale**: TanStack Query provides consistent loading/error states, automatic background
refetching, and cache coherence without bespoke boilerplate.

## Technology Stack

| Workspace | Technology | Version constraint |
|---|---|---|
| `ui/` | React | latest stable |
| `ui/` | Vite | latest stable |
| `ui/` | TanStack Query | latest stable (v5+) |
| `ui/` | OpenAPI client codegen | orval or openapi-typescript-codegen |
| `api/` | .NET / ASP.NET Core | 10 |
| `api/` | OpenAPI tooling | Swashbuckle.AspNetCore or NSwag |
| `infra/` | Terraform | latest stable (≥ 1.6) |
| `infra/` | Cloud provider | AWS |

Major version upgrades to any dependency MUST be proposed via a dedicated PR with documented
rationale and test evidence before merging.

## Development Workflow

### Quality Gates (all MUST pass before merge)

1. **TDD gate** — All new API business logic MUST have a failing test committed before
   implementation code. The PR description MUST reference the test commit SHA.
2. **SOLID gate** — Reviewer MUST confirm no SOLID violations exist in the diff.
3. **OpenAPI gate** — CI MUST regenerate the OpenAPI artefact and the UI client; any
   breaking change MUST be called out explicitly in the PR description.
4. **Terraform gate** — `terraform plan` output MUST be attached to any infra PR; destructive
   changes require a second reviewer's approval.
5. **Full suite GREEN** — Unit, integration, and contract tests MUST all pass in CI.

### Branch Strategy

- `main` — always deployable, protected; merges via PR only.
- `feature/<issue>-<short-description>` — feature work; rebased onto `main` before merge.
- `infra/<description>` — infrastructure-only changes.

### Commit Convention

Follow Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `infra:`.

## Governance

This constitution supersedes all other development practices and guidelines for this project.
Any practice not covered here defaults to industry-standard conventions for the relevant
technology.

**Amendment procedure**:
1. Open a PR modifying `.specify/memory/constitution.md`.
2. Increment `CONSTITUTION_VERSION` per semantic versioning rules:
   - MAJOR: principle removals or backward-incompatible redefinitions.
   - MINOR: new principle or section added.
   - PATCH: clarifications, wording, typo fixes.
3. Update any dependent templates (plan-template, tasks-template, spec-template) in the
   same PR.
4. Obtain approval from at least one other contributor before merging.
5. Set `LAST_AMENDED_DATE` to the merge date (ISO format YYYY-MM-DD).

**Compliance review**: All PRs MUST verify compliance with the applicable principles before
approval. Complexity beyond what is mandated here MUST be justified in writing in the PR
description.

For runtime development guidance, refer to the auto-generated agent file produced by
`/speckit.update-agent-file` and feature-specific `quickstart.md` files in `specs/`.

**Version**: 1.0.0 | **Ratified**: 2026-03-17 | **Last Amended**: 2026-03-17

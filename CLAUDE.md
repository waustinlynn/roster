# roster Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-17

## Active Technologies

- C# / .NET 10 (API), TypeScript / React + Vite latest (UI) (001-roster-management)

## Project Structure

```text
ui/          # React + Vite SPA; orval-generated client in ui/src/api/
api/         # .NET 10 solution: Roster.Domain / Application / Infrastructure / Api
infra/       # Terraform — modules/ + environments/dev + environments/prod
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

# Infra
cd infra/environments/dev && terraform init && terraform plan
```

## Code Style

- **C#**: Follow .NET conventions; use file-scoped namespaces; prefer records for value
  objects and domain events; use `sealed` on records; async/await throughout.
- **TypeScript**: Strict mode; functional components; no `any`; TanStack Query for all
  server state; generated client in `ui/src/api/` is read-only (do not hand-edit).
- **Terraform**: snake_case resource names; tag all resources with `env` and `project`.

## Recent Changes

- 001-roster-management: Added C# / .NET 10 (API), TypeScript / React + Vite latest (UI)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
